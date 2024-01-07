import { rimraf } from 'rimraf'
import {
  formatPublicKey,
  MachineStatusCommand,
  parseSshUrl,
  SshConnectionConfig,
  tunnelNameResolver,
} from '@preevy/common'
import { inspect } from 'util'
import { omit } from 'lodash-es'
import { createApp } from './src/api-server/index.js'
import { sshClient as createSshClient } from './src/ssh/index.js'
import { readConfig, Config, Plugin } from './src/configuration/index.js'
import { createLog } from './src/log.js'
import { Forward } from './src/forwards.js'
import { aggregator } from './src/aggregator.js'
import { loadPlugins } from './src/plugins.js'

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
  spec: MachineStatusCommand | undefined,
) => {
  if (!spec) {
    return undefined
  }
  const runner = plugins.map(p => p.machineStatusCommands?.[spec.recipe.type]).find(x => x)
  if (!runner) {
    throw new Error(`no handler found in plugins for machine status command with type "${spec.recipe.type}"`)
  }
  return async () => ({
    data: await runner(spec.recipe),
    contentType: spec.contentType,
  })
}

let log = createLog(process)
const SHUTDOWN_TIMEOUT = 5000
const exitSignals = ['SIGTERM', 'SIGINT', 'uncaughtException'] as const

const main = async () => {
  const config = await readConfig(process)

  log = createLog(process, config)

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

  const sshLog = log.child({ name: 'ssh' })
  sshLog.info('ssh client connecting to %j', serverUrl)
  const sshClient = disposables.use(await createSshClient({
    log: sshLog,
    connectionConfig,
    defaultAccess: config.defaultAccess,
    globalInjects: config.globalInjects,
  }))

  sshLog.info('ssh client connected to %j', serverUrl)
  sshClient.ssh.on('close', async () => {
    if (!endRequested) {
      log.error('ssh client closed unexpectedly')
      await end()
      process.exit(1)
    }
    log.info('ssh client closed')
  })

  const plugins = await loadPlugins(config, p => ({ log: log.child({ name: `plugin-${p}` }) }))

  const app = disposables.use(await createApp({
    log: log.child({ name: 'api' }),
    currentSshState: () => sshClient.state(),
    machineStatus: findMachineStatusCommandRunner(Object.values(plugins), machineStatusCommandSpec),
    envMetadata: config.envMetadata,
  }))

  const forwardsAggregator = aggregator<Forward>(f => f.externalName)
  await sshClient.updateForwards(forwardsAggregator(Symbol('staticConfig'), config.forwards))

  await Promise.all(Object.entries(plugins).map(async ([pluginName, plugin]) => {
    if (plugin.forwardsEmitter) {
      disposables.use(await plugin.forwardsEmitter({
        tunnelNameResolver: tunnelNameResolver({ envId }),
      })).on('forwards', async forwards => {
        await sshClient.updateForwards(forwardsAggregator(pluginName, forwards))
      })
    }

    if (plugin.fastifyPlugin) {
      await app.register(plugin.fastifyPlugin)
    }
  }))

  void app.listen({ ...await fastifyListenArgsFromConfig(config) })
  app.server.unref()

  exitSignals.forEach(signal => {
    process.once(signal, async (...args) => {
      const argsStr = args ? args.map(arg => inspect(arg)).join(', ') : undefined
      const logLevel = signal === 'uncaughtException' ? 'error' : 'warn'
      log[logLevel](`shutting down on ${[signal, argsStr].filter(Boolean).join(': ')}`)
      if (!await Promise.race([
        end().then(() => true),
        new Promise<void>(resolve => { setTimeout(resolve, SHUTDOWN_TIMEOUT) }),
      ])) {
        log.error(`timed out while waiting ${SHUTDOWN_TIMEOUT}ms for server to close, exiting`)
      }
      process.exit(1)
    })
  })
}

void main().catch(
  err => {
    log.error(err)
    process.exit(1)
  }
)
