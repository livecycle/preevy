import fs from 'fs'
import path from 'path'
import Docker from 'dockerode'
import { inspect } from 'node:util'
import http from 'node:http'
import { rimraf } from 'rimraf'
import pino from 'pino'
import pinoPretty from 'pino-pretty'
import { EOL } from 'os'
import { ConnectionCheckResult, requiredEnv, checkConnection, formatPublicKey, parseSshUrl, SshConnectionConfig, tunnelNameResolver, MachineStatusCommand } from '@preevy/common'
import createDockerClient from './src/docker'
import createApiServerHandler from './src/http/api-server'
import { sshClient as createSshClient } from './src/ssh'
import { createDockerProxyHandlers } from './src/http/docker-proxy'
import { tryHandler, tryUpgradeHandler } from './src/http/http-server-helpers'
import { httpServerHandlers } from './src/http'
import { runMachineStatusCommand } from './src/machine-status'

const homeDir = process.env.HOME || '/root'
const dockerSocket = '/var/run/docker.sock'

const readDir = async (dir: string) => {
  try {
    return ((await fs.promises.readdir(dir, { withFileTypes: true })) ?? [])
      .filter(d => d.isFile()).map(f => f.name)
  } catch (e) {
    if ((e as { code: string }).code === 'ENOENT') {
      return []
    }
    throw e
  }
}

const readAllFiles = async (dir: string) => {
  const files = await readDir(dir)
  return await Promise.all(
    files.map(file => fs.promises.readFile(path.join(dir, file), { encoding: 'utf8' }))
  )
}

const sshConnectionConfigFromEnv = async (): Promise<{ connectionConfig: SshConnectionConfig; sshUrl: string }> => {
  const sshUrl = requiredEnv('SSH_URL')
  const parsed = parseSshUrl(sshUrl)

  const clientPrivateKey = process.env.SSH_PRIVATE_KEY || fs.readFileSync(
    path.join(homeDir, '.ssh', 'id_rsa'),
    { encoding: 'utf8' },
  )

  const knownServerPublicKeys = await readAllFiles(path.join(homeDir, 'known_server_keys'))

  return {
    sshUrl,
    connectionConfig: {
      ...parsed,
      clientPrivateKey,
      username: process.env.PREEVY_ENV_ID ?? 'foo',
      knownServerPublicKeys,
      insecureSkipVerify: Boolean(process.env.INSECURE_SKIP_VERIFY),
      tlsServerName: process.env.TLS_SERVERNAME || undefined,
    },
  }
}

const formatConnectionCheckResult = (
  r: ConnectionCheckResult,
) => {
  if ('unverifiedHostKey' in r) {
    return { unverifiedHostKey: formatPublicKey(r.unverifiedHostKey) }
  }
  if ('error' in r) {
    return { error: r.error.message || r.error.toString(), stack: r.error.stack, details: inspect(r.error) }
  }
  return r
}

const writeLineToStdout = (s: string) => [s, EOL].forEach(d => process.stdout.write(d))

const machineStatusCommand = process.env.MACHINE_STATUS_COMMAND
  ? JSON.parse(process.env.MACHINE_STATUS_COMMAND) as MachineStatusCommand
  : undefined

const log = pino({
  level: process.env.DEBUG || process.env.DOCKER_PROXY_DEBUG ? 'debug' : 'info',
}, pinoPretty({ destination: pino.destination(process.stderr) }))

const main = async () => {
  const { connectionConfig, sshUrl } = await sshConnectionConfigFromEnv()

  log.debug('ssh config: %j', {
    ...connectionConfig,
    clientPrivateKey: '*** REDACTED ***',
    clientPublicKey: formatPublicKey(connectionConfig.clientPrivateKey),
  })

  if (process.env.SSH_CHECK_ONLY || process.argv.includes('check')) {
    const result = await checkConnection({
      connectionConfig,
      log: log.child({ name: 'ssh' }, { level: 'warn' }),
    })
    writeLineToStdout(JSON.stringify(formatConnectionCheckResult(result)))
    process.exit(0)
  }

  const docker = new Docker({ socketPath: dockerSocket })
  const dockerClient = createDockerClient({ log: log.child({ name: 'docker' }), docker, debounceWait: 500 })

  const sshLog = log.child({ name: 'ssh' })
  const sshClient = await createSshClient({
    connectionConfig,
    tunnelNameResolver: tunnelNameResolver({ userDefinedSuffix: process.env.TUNNEL_URL_SUFFIX }),
    log: sshLog,
    onError: err => {
      log.error(err)
      process.exit(1)
    },
  })

  sshLog.info('ssh client connected to %j', sshUrl)
  let currentTunnels = dockerClient.getRunningServices().then(services => sshClient.updateTunnels(services))

  void dockerClient.startListening({
    onChange: async services => {
      currentTunnels = sshClient.updateTunnels(services)
      void currentTunnels.then(ssh => writeLineToStdout(JSON.stringify(ssh)))
    },
  })

  const apiListenAddress = process.env.PORT ?? 3000
  if (typeof apiListenAddress === 'string' && Number.isNaN(Number(apiListenAddress))) {
    await rimraf(apiListenAddress)
  }

  const { handler, upgradeHandler } = httpServerHandlers({
    log: log.child({ name: 'http' }),
    apiHandler: createApiServerHandler({
      log: log.child({ name: 'api' }),
      currentSshState: async () => (await currentTunnels),
      machineStatus: machineStatusCommand
        ? async () => await runMachineStatusCommand({ log, docker })(machineStatusCommand)
        : undefined,
    }),
    dockerProxyHandlers: createDockerProxyHandlers({
      log: log.child({ name: 'docker-proxy' }),
      dockerSocket,
      docker,
    }),
    dockerProxyPrefix: '/docker/',
  })

  const httpLog = log.child({ name: 'http' })

  const httpServer = http.createServer(tryHandler({ log: httpLog }, async (req, res) => {
    httpLog.debug('request %s %s', req.method, req.url)
    return await handler(req, res)
  }))
    .on('upgrade', tryUpgradeHandler({ log: httpLog }, async (req, socket, head) => {
      httpLog.debug('upgrade %s %s', req.method, req.url)
      return await upgradeHandler(req, socket, head)
    }))
    .listen(apiListenAddress, () => {
      httpLog.info(`API server listening on ${inspect(httpServer.address())}`)
    })
    .on('error', err => {
      httpLog.error(err)
      process.exit(1)
    })
    .unref()
}

void main();

['SIGTERM', 'SIGINT'].forEach(signal => {
  process.once(signal, async () => {
    log.info(`shutting down on ${signal}`)
    process.exit(0)
  })
})
