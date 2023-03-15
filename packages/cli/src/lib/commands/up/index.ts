import fs from 'fs'
import retry from 'p-retry'
import yaml from 'yaml'
import path from 'path'
import { rimraf } from 'rimraf'
import { Logger } from '../../../log'
import { Machine, MachineDriver } from '../../machine'
import { FileToCopy, SshClient } from '../../ssh/client'
import { SSHKeyConfig } from '../../ssh/keypair'
import { addDockerProxyService, fixModelForRemote } from '../../compose'
import { DOCKER_PROXY_PORT, DOCKER_PROXY_DIR } from '../../../static'
import { TunnelOpts } from '../../ssh/url'
import { ensureCustomizedMachine } from './machine'
import { wrapWithDockerSocket } from './docker'
import { dockerCompose } from './compose-runner'
import { Tunnel } from '../../tunneling'

const REMOTE_DIR_BASE = '/var/lib/preview'

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

const DOCKER_PROXY_SERVICE_NAME = 'preview_proxy'

const createCopiedFileInDataDir = (
  { projectLocalDataDir, filesToCopy, remoteDir } : {
    projectLocalDataDir: string
    filesToCopy: FileToCopy[]
    remoteDir: string
  }
) => async (
  filename: string,
  content: string | Buffer
): Promise<{ local: string; remote: string }> => {
  const local = path.join(projectLocalDataDir, filename)
  await fs.promises.mkdir(path.dirname(local), { recursive: true })
  await fs.promises.writeFile(local, content, { flag: 'w' })
  filesToCopy.push({ local, remote: filename })
  return { local, remote: path.join(remoteDir, filename) }
}

const up = async ({
  machineDriver,
  tunnelOpts,
  envId,
  log,
  composeFiles: userComposeFiles,
  dataDir,
  projectDir,
  sshKey,
  AllowedSshHostKeys: hostKey,
  sshTunnelPrivateKey,
}: {
  machineDriver: MachineDriver
  tunnelOpts: TunnelOpts
  envId: string
  log: Logger
  composeFiles?: string[]
  dataDir: string
  projectDir: string
  sshKey: SSHKeyConfig
  sshTunnelPrivateKey: string
  AllowedSshHostKeys: Buffer
}): Promise<{ machine: Machine; tunnels: Tunnel[] }> => {
  log.debug('Normalizing compose files')

  const userModel = await dockerCompose(...userComposeFiles || []).getModel()
  const remoteDir = path.join(REMOTE_DIR_BASE, 'projects', userModel.name)
  const { model: fixedModel, filesToCopy } = await fixModelForRemote({
    remoteDir,
    localDir: projectDir,
  }, userModel)

  const projectLocalDataDir = path.join(dataDir, userModel.name)
  await rimraf(projectLocalDataDir)

  const createCopiedFile = createCopiedFileInDataDir({ projectLocalDataDir, filesToCopy, remoteDir })
  const [sshPrivateKeyFile, knownServerPublicKey] = await Promise.all([
    createCopiedFile('tunnel_client_private_key', sshTunnelPrivateKey),
    createCopiedFile('tunnel_server_public_key', hostKey),
  ])

  const remoteModel = addDockerProxyService({
    tunnelOpts,
    buildDir: DOCKER_PROXY_DIR,
    port: DOCKER_PROXY_PORT,
    serviceName: DOCKER_PROXY_SERVICE_NAME,
    sshPrivateKeyPath: sshPrivateKeyFile.remote,
    knownServerPublicKeyPath: knownServerPublicKey.remote,
  }, fixedModel)

  log.debug('model', yaml.stringify(remoteModel))

  const composeFilePath = (await createCopiedFile('docker-compose.yml', yaml.stringify(remoteModel))).local

  const { machine, sshClient } = await ensureCustomizedMachine({ machineDriver, sshKey, envId, log })

  const withDockerSocket = wrapWithDockerSocket({ sshClient, log, dataDir: projectLocalDataDir })

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

    const { tunnels } = await queryTunnels(sshClient, dockerProxyServiceUrl)

    return {
      machine,
      tunnels: tunnels.filter((t: Tunnel) => t.service !== DOCKER_PROXY_SERVICE_NAME),
    }
  } finally {
    sshClient.dispose()
  }
}

export default up
