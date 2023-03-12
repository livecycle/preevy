import fs from 'fs'
import retry from 'p-retry'
import yaml from 'yaml'
import path from 'path'
import { checkConnection, keyFingerprint, parseSshUrl, formatSshConnectionConfig } from '@livecycle/docker-proxy'
import { Logger } from '../../../log'
import { Machine, MachineDriver } from '../../machine'
import { FileToCopy, SshClient } from '../../ssh/client'
import { generateSshKeyPair, SshKeyPair } from '../../ssh/keypair'
import { PersistentState } from '../../state'
import { addDockerProxyService, fixModelForRemote } from '../../compose'
import { DOCKER_PROXY_PORT, DOCKER_PROXY_DIR } from '../../../static'
import { TunnelOpts } from '../../ssh/url'
import { ensureCustomizedMachine } from './machine'
import { wrapWithDockerSocket } from './docker'
import { dockerCompose } from './compose-runner'

const REMOTE_DIR_BASE = '/var/run/preview'

const queryTunnels = async (sshClient: SshClient, dockerProxyUrl: string) => {
  const { tunnels, clientId: tunnelId } = await retry(async () => JSON.parse((
    await sshClient.execCommand(`curl -sf http://${dockerProxyUrl}/tunnels`)
  ).stdout), { minTimeout: 1000, maxTimeout: 2000, retries: 10 })

  return { tunnels, tunnelId }
}

const copyFilesWithoutRecreatingDir = async (
  sshClient: SshClient,
  remoteDir: string,
  filesToCopy: FileToCopy[],
) => {
  const remoteTempDir = (await sshClient.execCommand(`sudo mktemp -d -p "${REMOTE_DIR_BASE}"`)).stdout
  await sshClient.execCommand(`sudo chown $USER:docker "${remoteTempDir}"`)
  const filesToCopyToTempDir = filesToCopy.map(
    ({ local, remote }) => ({ local, remote: path.join(remoteTempDir, remote) })
  )
  await sshClient.putFiles(filesToCopyToTempDir)
  await sshClient.execCommand(`rsync -ac --delete "${remoteTempDir}/" "${remoteDir}" && sudo rm -rf "${remoteTempDir}"`)
}

export type Tunnel = {
  project: string
  service: string
  ports: Record<string, string[]>
}

export class UnverifiedHostKeyError extends Error {
  constructor(
    readonly tunnelOpts: TunnelOpts,
    readonly hostKeySignature: string,
  ) {
    super(`Host key verification failed for connection ${tunnelOpts.url}`)
    this.name = 'UnverifiedHostKeyError'
  }
}

export type HostKeySignatureConfirmer = (
  o: { hostKeyFingerprint: string; hostname: string; port: number | undefined }
) => Promise<void>

const performTunnelConnectionCheck = async ({
  log,
  tunnelOpts,
  clientPrivateKey,
  username,
  keysState,
  confirmHostFingerprint,
}: {
  log: Logger
  tunnelOpts: TunnelOpts
  clientPrivateKey: string | Buffer
  username: string
  keysState: PersistentState['knownServerPublicKeys']
  confirmHostFingerprint: HostKeySignatureConfirmer
}) => {
  const parsed = parseSshUrl(tunnelOpts.url)

  const connectionConfigBase = {
    ...parsed,
    clientPrivateKey,
    username,
    tlsServerName: tunnelOpts.tlsServerName,
    insecureSkipVerify: tunnelOpts.insecureSkipVerify,
  }

  const check = async (): Promise<void> => {
    const knownServerPublicKeys = await keysState.read(parsed.hostname, parsed.port)
    const connectionConfig = { ...connectionConfigBase, knownServerPublicKeys }

    log.debug('connection check with config', formatSshConnectionConfig(connectionConfig))

    const result = await checkConnection({ log, connectionConfig })

    if ('clientId' in result) {
      if (!knownServerPublicKeys.includes(result.hostKey)) {
        await keysState.write(parsed.hostname, parsed.port, result.hostKey)
      }
      return undefined
    }

    if ('error' in result) {
      log.error('error checking connection', result.error)
      throw new Error(`Cannot connect to ${tunnelOpts.url}: ${result.error.message}`)
    }

    await confirmHostFingerprint({
      hostKeyFingerprint: keyFingerprint(result.unverifiedHostKey),
      hostname: parsed.hostname,
      port: parsed.port,
    })

    await keysState.write(parsed.hostname, parsed.port, result.unverifiedHostKey)

    return check()
  }

  return check()
}

const ensureTunnelKeyPair = async (
  { state, log }: {
    state: PersistentState['tunnelKeyPair']
    log: Logger
  },
) => {
  const existingKeyPair = await state.read()
  if (existingKeyPair) {
    return existingKeyPair
  }
  log.info('Creating new SSH key pair')
  const keyPair = await generateSshKeyPair()
  await state.write(keyPair)
  return keyPair
}

const DOCKER_PROXY_SERVICE_NAME = 'preview_proxy'

const up = async ({
  machineDriver,
  tunnelOpts,
  envId,
  state,
  log,
  composeFiles: userComposeFiles,
  dataDir,
  projectDir,
  confirmHostFingerprint,
}: {
  machineDriver: MachineDriver
  tunnelOpts: TunnelOpts
  envId: string
  state: PersistentState
  log: Logger
  composeFiles?: string[]
  dataDir: string
  projectDir: string
  confirmHostFingerprint: HostKeySignatureConfirmer
}): Promise<{ machine: Machine; keyPair: SshKeyPair; tunnelId: string; tunnels: Tunnel[] }> => {
  log.debug('Normalizing compose files')

  const userModel = await dockerCompose(...userComposeFiles || []).getModel()
  const tunnelKeyPair = await ensureTunnelKeyPair({ state: state.tunnelKeyPair, log })
  const remoteDir = path.join(REMOTE_DIR_BASE, userModel.name)

  const { model: fixedModel, filesToCopy } = await fixModelForRemote({
    remoteDir,
    localDir: projectDir,
  }, userModel)

  const remoteModel = addDockerProxyService({
    tunnelOpts,
    buildDir: DOCKER_PROXY_DIR,
    port: DOCKER_PROXY_PORT,
    serviceName: DOCKER_PROXY_SERVICE_NAME,
    sshPrivateKey: tunnelKeyPair.privateKey,
  }, fixedModel)

  log.debug('model', yaml.stringify(remoteModel))
  const projectLocalDataDir = path.join(dataDir, userModel.name)
  await fs.promises.mkdir(projectLocalDataDir, { recursive: true })
  const composeFilePath = path.join(projectLocalDataDir, 'docker-compose.yml')
  await fs.promises.writeFile(composeFilePath, yaml.stringify(remoteModel), { flag: 'w' })

  // though not needed, it's useful for debugging to have the compose file at the remote machine
  filesToCopy.push({ local: composeFilePath, remote: 'docker-compose.yml' })

  await performTunnelConnectionCheck({
    log,
    tunnelOpts,
    clientPrivateKey: tunnelKeyPair.privateKey,
    username: process.env.USER || 'preview',
    confirmHostFingerprint,
    keysState: state.knownServerPublicKeys,
  })

  const { machine, keyPair, sshClient } = await ensureCustomizedMachine({ machineDriver, envId, state, log })

  const withDockerSocket = wrapWithDockerSocket({ sshClient, log, dataDir })

  try {
    await sshClient.execCommand(`sudo mkdir -p "${remoteDir}" && sudo chown $USER:docker "${remoteDir}"`)

    log.debug('Files to copy', filesToCopy)

    log.info('Copying files')
    await copyFilesWithoutRecreatingDir(sshClient, remoteDir, filesToCopy)

    const compose = dockerCompose(composeFilePath)

    log.debug('Running compose up')

    await withDockerSocket(() => compose.spawnPromise(
      ['--verbose', 'up', '-d', '--remove-orphans', '--build', '--wait'],
      { stdio: 'inherit' },
    ))

    log.info('Getting tunnels')

    const dockerProxyServiceUrl = await withDockerSocket(
      () => compose.getServiceUrl(DOCKER_PROXY_SERVICE_NAME, DOCKER_PROXY_PORT)
    )

    const { tunnelId, tunnels } = await queryTunnels(sshClient, dockerProxyServiceUrl)

    return {
      machine,
      keyPair,
      tunnelId,
      tunnels: tunnels.filter((t: Tunnel) => t.service !== DOCKER_PROXY_SERVICE_NAME),
    }
  } finally {
    sshClient.dispose()
  }
}

export default up
