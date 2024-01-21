import { rimraf } from 'rimraf'
import {
  formatPublicKey,
  isDefined,
  MachineStatusCommand,
  parseSshUrl,
  SshConnectionConfig,
  tunnelNameResolver,
} from '@preevy/common'
import { omit } from 'lodash-es'
import { createApp } from './api-server/index.js'
import { sshClient as createSshClient } from './ssh/index.js'
import { readConfig, Config } from './configuration/index.js'
import { Plugin, PluginFactory } from './plugin-definition.js'
import { createLog } from './log.js'
import { Forward } from './forwards.js'
import { sourceAggregator } from './source-aggregator.js'
import { loadPlugins, pluginFactories, PluginOpts } from './plugins/index.js'
import { Opts } from './configuration/opts.js'

const fastifyListenArgsFromConfig = async (config: Pick<Config, 'listen'>) => {
  const portOrPath = config.listen
  const portNumber = Number(portOrPath)
  if (typeof portOrPath === 'string' && Number.isNaN(portNumber)) {
    await rimraf(portOrPath)
    return { path: portOrPath }
  }
  return { port: portNumber, host: '0.0.0.0' }
}

const findMachineStatusCommandRunner = (
  plugins: Plugin[],
  spec: MachineStatusCommand,
) => {
  const runner = plugins.map(p => p.machineStatusCommands?.[spec.recipe.type]).find(x => x)
  if (!runner) {
    throw new Error(`no handler found in plugins for machine status command with type "${spec.recipe.type}"`)
  }
  return async () => ({
    data: await runner(spec.recipe),
    contentType: spec.contentType,
  })
}

export const main = async (
  process: Pick<NodeJS.Process, 'stdout' | 'stderr' | 'argv' | 'exit'>,
) => {
  const config = await readConfig(
    pluginFactories as unknown as Record<string, PluginFactory<Opts & PluginOpts>>,
    process,
  )

  const log = createLog(process, config)
  const initPromises: Promise<unknown>[] = []

  let endRequested = false
  const disposables = new AsyncDisposableStack()
  const end = async () => {
    endRequested = true
    await disposables.disposeAsync()
  }

  const {
    server: serverUrl,
    envId,
    machineStatusCommand: machineStatusCommandSpec,
  } = config

  const connectionConfig: SshConnectionConfig = {
    ...parseSshUrl(serverUrl),
    clientPrivateKey: await config.privateKey,
    username: envId,
    knownServerPublicKeys: config.serverKey,
    insecureSkipVerify: Boolean(config.insecureSkipVerify),
    tlsServerName: config.tlsServerName,
  }

  log.debug('ssh config: %j', {
    ...omit<SshConnectionConfig, 'clientPrivateKey'>(connectionConfig, 'clientPrivateKey'),
    clientPublicKey: formatPublicKey(connectionConfig.clientPrivateKey),
  })

  const forwardsAggregator = sourceAggregator<Forward>(f => f.externalName)
  const pluginsPromise = loadPlugins(config, p => ({ log: log.child({ name: `plugin-${p}` }) }))
  initPromises.push(pluginsPromise)

  const sshClientPromise = createSshClient({
    log: log.child({ name: 'ssh' }),
    connectionConfig,
    defaultAccess: config.defaultAccess,
    globalInjects: config.globalInjects,
  }).then(async sshClient => {
    disposables.use(sshClient)
    sshClient.ssh.on('close', async () => {
      if (!endRequested) {
        log.error('ssh client closed unexpectedly')
        await end()
        process.exit(1)
      }
      log.info('ssh client closed')
    })

    if (config.forwards.length) {
      void sshClient.updateForwards(forwardsAggregator(Symbol('staticConfig'), config.forwards))
    }

    await pluginsPromise.then(async plugins => {
      await Promise.all(Object.entries(plugins).map(async ([pluginName, plugin]) => {
        if (plugin.forwardsEmitter) {
          disposables.use(await plugin.forwardsEmitter({
            tunnelNameResolver: tunnelNameResolver({ envId }),
          })).on('forwards', forwards => sshClient.updateForwards(forwardsAggregator(pluginName, forwards)))
        }
      }))
    })

    return sshClient
  })

  initPromises.push(sshClientPromise)

  initPromises.push(createApp({
    log: log.child({ name: 'api' }),
    currentSshState: () => sshClientPromise.then(sshClient => sshClient.state()),
    machineStatus: machineStatusCommandSpec
      ? () => pluginsPromise.then(
        plugins => findMachineStatusCommandRunner(Object.values(plugins), machineStatusCommandSpec)()
      )
      : undefined,
    envMetadata: config.envMetadata,
  }).then(async app => {
    disposables.use(app)
    await pluginsPromise.then(plugins => Promise.all(
      Object.values(plugins)
        .map(({ fastifyPlugin }) => fastifyPlugin)
        .filter(isDefined)
        .map(fastifyPlugin => app.register(fastifyPlugin))
    ))
    await app.listen(await fastifyListenArgsFromConfig(config))
  }))

  return {
    log,
    init: Promise.all(initPromises).then(() => undefined as void),
    [Symbol.asyncDispose]: end,
  }
}
