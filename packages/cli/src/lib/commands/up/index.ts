import fs from 'fs'
import retry from 'p-retry'
import yaml from 'yaml'
import path from 'path'
import { rimraf } from 'rimraf'
import { Logger } from '../../../log'
import { Machine, MachineDriver } from '../../machine'
import { FileToCopy, SshClient } from '../../ssh/client'
import { SSHKeyConfig } from '../../ssh/keypair'
import { fixModelForRemote } from '../../compose/model'
import { TunnelOpts } from '../../ssh/url'
import { ensureCustomizedMachine } from './machine'
import { wrapWithDockerSocket } from './docker'
import { localComposeClient } from '../../compose/client'
import { Tunnel } from '../../tunneling'
import { findAmbientEnvId } from '../../env-id'
import { addDockerProxyService, findDockerProxyUrl, queryTunnels } from '../../docker-proxy-client'

const REMOTE_DIR_BASE = '/var/lib/preview'

const queryTunnelsWithRetry = async (
  sshClient: SshClient,
  dockerProxyUrl: string,
) => retry(
  () => queryTunnels(sshClient, dockerProxyUrl),
  { minTimeout: 1000, maxTimeout: 2000, retries: 10 },
)

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
  userSpecifiedProjectName,
  userSpecifiedEnvId,
  log,
  composeFiles: userComposeFiles,
  dataDir,
  projectDir,
  sshKey,
  allowedSshHostKeys: hostKey,
  sshTunnelPrivateKey,
}: {
  machineDriver: MachineDriver
  tunnelOpts: TunnelOpts
  userSpecifiedProjectName: string | undefined
  userSpecifiedEnvId: string | undefined
  log: Logger
  composeFiles: string[]
  dataDir: string
  projectDir: string
  sshKey: SSHKeyConfig
  sshTunnelPrivateKey: string
  allowedSshHostKeys: Buffer
}): Promise<{ machine: Machine; tunnels: Tunnel[]; envId: string }> => {
  log.debug('Normalizing compose files')

  const userModel = await localComposeClient(userComposeFiles).getModel()
  const projectName = userSpecifiedProjectName ?? userModel.name
  const remoteDir = path.join(REMOTE_DIR_BASE, 'projects', projectName)
  const { model: fixedModel, filesToCopy } = await fixModelForRemote({
    remoteDir,
    localDir: projectDir,
  }, userModel)

  const projectLocalDataDir = path.join(dataDir, projectName)
  await rimraf(projectLocalDataDir)

  const createCopiedFile = createCopiedFileInDataDir({ projectLocalDataDir, filesToCopy, remoteDir })
  const [sshPrivateKeyFile, knownServerPublicKey] = await Promise.all([
    createCopiedFile('tunnel_client_private_key', sshTunnelPrivateKey),
    createCopiedFile('tunnel_server_public_key', hostKey),
  ])

  const envId = userSpecifiedEnvId || await findAmbientEnvId(projectName)

  log.info(`Using envId: ${envId}`)

  const remoteModel = addDockerProxyService({
    tunnelOpts,
    urlSuffix: envId,
    sshPrivateKeyPath: sshPrivateKeyFile.remote,
    knownServerPublicKeyPath: knownServerPublicKey.remote,
  }, fixedModel)

  log.debug('model', yaml.stringify(remoteModel))

  const composeFilePath = (await createCopiedFile('docker-compose.yml', yaml.stringify(remoteModel))).local

  const { machine, sshClient } = await ensureCustomizedMachine({ machineDriver, sshKey, envId, log })

  const withDockerSocket = wrapWithDockerSocket({ sshClient, log })

  try {
    await sshClient.execCommand(`sudo mkdir -p "${remoteDir}" && sudo chown $USER:docker "${remoteDir}"`)

    log.debug('Files to copy', filesToCopy)

    log.info('Copying files')
    await copyFilesWithoutRecreatingDir(sshClient, remoteDir, filesToCopy)

    const compose = localComposeClient([composeFilePath])

    log.debug('Running compose up')

    await withDockerSocket(() => compose.spawnPromise(
      ['--verbose', 'up', '-d', '--remove-orphans', '--build', '--wait'],
      { stdio: 'inherit' },
    ))

    log.info('Getting tunnels')

    const dockerProxyServiceUrl = await withDockerSocket(() => findDockerProxyUrl(compose))

    const { tunnels } = await queryTunnelsWithRetry(sshClient, dockerProxyServiceUrl)

    return { envId, machine, tunnels }
  } finally {
    sshClient.dispose()
  }
}

export default up
