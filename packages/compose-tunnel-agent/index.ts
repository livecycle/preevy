import fs from 'fs'
import path from 'path'
import Docker from 'dockerode'
import { rimraf } from 'rimraf'
import { pino } from 'pino'
import pinoPrettyModule from 'pino-pretty'
import {
  requiredEnv,
  formatPublicKey,
  parseSshUrl,
  SshConnectionConfig,
  tunnelNameResolver,
  MachineStatusCommand,
  COMPOSE_TUNNEL_AGENT_PORT,
  ScriptInjection,
} from '@preevy/common'
import { inspect } from 'util'
import { createApp } from './src/api-server/index.js'
import { sshClient as createSshClient } from './src/ssh/index.js'
import { runMachineStatusCommand } from './src/machine-status.js'
import { envMetadata } from './src/metadata.js'
import { readAllFiles } from './src/files.js'
import {
  forwardsEmitter as createDockerForwardsEmitter,
  filteredClient as createDockerFilteredClient,
} from './src/plugins/docker/forwards-emitter/index.js'
import { anyComposeProjectFilters, composeProjectFilters } from './src/plugins/docker/filters.js'

const PinoPretty = pinoPrettyModule.default

const homeDir = process.env.HOME || '/root'
const dockerSocket = '/var/run/docker.sock'
const composeModelPath = '/preevy/docker-compose.yaml'
const envId = requiredEnv('PREEVY_ENV_ID')

const targetComposeProject = process.env.COMPOSE_PROJECT
const defaultAccess = process.env.DEFAULT_ACCESS_LEVEL === 'private' ? 'private' : 'public'

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
      username: envId,
      knownServerPublicKeys,
      insecureSkipVerify: Boolean(process.env.INSECURE_SKIP_VERIFY),
      tlsServerName: process.env.TLS_SERVERNAME || undefined,
    },
  }
}

const fastifyListenArgsFromEnv = async () => {
  const portOrPath = process.env.PORT ?? COMPOSE_TUNNEL_AGENT_PORT
  const portNumber = Number(portOrPath)
  if (typeof portOrPath === 'string' && Number.isNaN(portNumber)) {
    await rimraf(portOrPath)
    return { path: portOrPath }
  }
  return { port: portNumber, host: '0.0.0.0' }
}

const machineStatusCommand = process.env.MACHINE_STATUS_COMMAND
  ? JSON.parse(process.env.MACHINE_STATUS_COMMAND) as MachineStatusCommand
  : undefined

const globalInjects = process.env.GLOBAL_INJECT_SCRIPTS
  ? JSON.parse(process.env.GLOBAL_INJECT_SCRIPTS) as ScriptInjection[]
  : []

const log = pino({
  level: process.env.DEBUG || process.env.DOCKER_PROXY_DEBUG ? 'debug' : 'info',
}, PinoPretty({ destination: pino.destination(process.stderr) }))

const main = async () => {
  let endRequested = false
  const { connectionConfig, sshUrl } = await sshConnectionConfigFromEnv()

  log.debug('ssh config: %j', {
    ...connectionConfig,
    clientPrivateKey: '*** REDACTED ***',
    clientPublicKey: formatPublicKey(connectionConfig.clientPrivateKey),
  })

  const dockerFilters = targetComposeProject
    ? composeProjectFilters({ composeProject: targetComposeProject })
    : anyComposeProjectFilters

  const docker = new Docker({ socketPath: dockerSocket })
  const dockerForwardsEmitter = createDockerForwardsEmitter({
    log: log.child({ name: 'docker' }),
    docker,
    debounceWait: 500,
    filters: dockerFilters,
    tunnelNameResolver: tunnelNameResolver({ envId }),
  })

  const sshLog = log.child({ name: 'ssh' })
  const sshClient = await createSshClient({
    log: sshLog,
    connectionConfig,
    defaultAccess,
    globalInjects,
  })

  sshClient.ssh.on('close', () => {
    if (!endRequested) {
      log.error('ssh client closed unexpectedly')
      process.exit(1)
    }
    log.info('ssh client closed')
  })

  sshLog.info('ssh client connected to %j', sshUrl)

  void dockerForwardsEmitter.then(client => client.on('forwards', forwards => sshClient.updateForwards(forwards)))

  const app = await createApp({
    log: log.child({ name: 'api' }),
    currentSshState: () => sshClient.state(),
    machineStatus: machineStatusCommand
      ? async () => await runMachineStatusCommand({ log, docker })(machineStatusCommand)
      : undefined,
    envMetadata: await envMetadata({ env: process.env, log }),
    composeModelPath: fs.existsSync(composeModelPath) ? composeModelPath : undefined,
    dockerModem: docker.modem,
    dockerFilter: createDockerFilteredClient({ docker, filters: dockerFilters }),
  })

  void app.listen({ ...await fastifyListenArgsFromEnv() })
  app.server.unref()

  const end = async () => {
    endRequested = true
    await Promise.all([
      app.close(),
      sshClient.end(),
      dockerForwardsEmitter.then(client => client[Symbol.asyncDispose]()),
    ])
  }

  return { end }
}

const SHUTDOWN_TIMEOUT = 5000

void main().then(
  ({ end }) => {
    ['SIGTERM', 'SIGINT', 'uncaughtException'].forEach(signal => {
      process.once(signal, async (...args) => {
        const argsStr = args ? args.map(arg => inspect(arg)).join(', ') : undefined
        log.warn(`shutting down on ${[signal, argsStr].filter(Boolean).join(': ')}`)
        const endResult = await Promise.race([
          end().then(() => true),
          new Promise<void>(resolve => { setTimeout(resolve, SHUTDOWN_TIMEOUT) }),
        ])
        if (!endResult) {
          log.error(`timed out while waiting ${SHUTDOWN_TIMEOUT}ms for server to close, exiting`)
        }
        process.exit(1)
      })
    })
  },
  err => {
    log.error(err)
    process.exit(1)
  }
)
