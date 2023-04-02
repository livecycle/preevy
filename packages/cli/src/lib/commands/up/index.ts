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
import { DOCKER_PROXY_SERVICE_NAME, addDockerProxyService, findDockerProxyUrl, queryTunnels } from '../../docker-proxy-client'
import { copyFilesWithoutRecreatingDirUsingSftp } from '../../sftp-copy'
import { withSpinner } from '../../spinner'

const REMOTE_DIR_BASE = '/var/lib/preevy'

const queryTunnelsWithRetry = async (
  sshClient: SshClient,
  dockerProxyUrl: string,
  filterServices?: string[]
) => retry(
  () => queryTunnels(sshClient, dockerProxyUrl, filterServices),
  { minTimeout: 1000, maxTimeout: 2000, retries: 10 },
)

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

const calcComposeArgs = (userSpecifiedServices: string[], debug: boolean) => {
  const upServices = userSpecifiedServices.length
    ? userSpecifiedServices.concat(DOCKER_PROXY_SERVICE_NAME)
    : []

  return [
    ...debug ? ['--verbose'] : [],
    'up', '-d', '--remove-orphans', '--build',
    ...upServices,
  ]
}

const up = async ({
  debug,
  machineDriver,
  tunnelOpts,
  userSpecifiedProjectName,
  userSpecifiedEnvId,
  userSpecifiedServices,
  log,
  composeFiles: userComposeFiles,
  dataDir,
  sshKey,
  allowedSshHostKeys: hostKey,
  sshTunnelPrivateKey,
}: {
  debug: boolean
  machineDriver: MachineDriver
  tunnelOpts: TunnelOpts
  userSpecifiedProjectName: string | undefined
  userSpecifiedEnvId: string | undefined
  userSpecifiedServices: string[]
  log: Logger
  composeFiles: string[]
  dataDir: string
  sshKey: SSHKeyConfig
  sshTunnelPrivateKey: string
  allowedSshHostKeys: Buffer
}): Promise<{ machine: Machine; tunnels: Tunnel[]; envId: string }> => {
  log.debug('Normalizing compose files')

  const userModel = await localComposeClient(userComposeFiles).getModel()
  const projectName = userSpecifiedProjectName ?? userModel.name
  const remoteDir = path.join(REMOTE_DIR_BASE, 'projects', projectName)
  const { model: fixedModel, filesToCopy } = await fixModelForRemote({ remoteDir }, userModel)

  const projectLocalDataDir = path.join(dataDir, projectName)
  await rimraf(projectLocalDataDir)

  const createCopiedFile = createCopiedFileInDataDir({ projectLocalDataDir, filesToCopy, remoteDir })
  const [sshPrivateKeyFile, knownServerPublicKey] = await Promise.all([
    createCopiedFile('tunnel_client_private_key', sshTunnelPrivateKey),
    createCopiedFile('tunnel_server_public_key', hostKey),
  ])

  const envId = userSpecifiedEnvId || await findAmbientEnvId(projectName)

  log.info(`Using environment ID: ${envId}`)

  const remoteModel = addDockerProxyService({
    debug,
    tunnelOpts,
    urlSuffix: envId,
    sshPrivateKeyPath: sshPrivateKeyFile.remote,
    knownServerPublicKeyPath: knownServerPublicKey.remote,
  }, fixedModel)

  log.debug('model', yaml.stringify(remoteModel))

  const composeFilePath = (await createCopiedFile('docker-compose.yml', yaml.stringify(remoteModel))).local

  const { machine, sshClient } = await ensureCustomizedMachine({ machineDriver, sshKey, envId, log, debug })

  const withDockerSocket = wrapWithDockerSocket({ sshClient, log })

  try {
    await sshClient.execCommand(`sudo mkdir -p "${remoteDir}" && sudo chown $USER:docker "${remoteDir}"`)

    log.debug('Files to copy', filesToCopy)

    await copyFilesWithoutRecreatingDirUsingSftp(sshClient, REMOTE_DIR_BASE, remoteDir, filesToCopy)

    const compose = localComposeClient([composeFilePath])
    const composeArgs = calcComposeArgs(userSpecifiedServices, debug)
    log.debug('Running compose up with args: ', composeArgs)
    await withDockerSocket(() => compose.spawnPromise(composeArgs, { stdio: 'inherit' }))

    const tunnels = await withSpinner(async () => {
      const dockerProxyServiceUrl = await withDockerSocket(() => findDockerProxyUrl(compose))

      const queryResult = await queryTunnelsWithRetry(
        sshClient,
        dockerProxyServiceUrl,
        userSpecifiedServices,
      )

      return queryResult.tunnels
    }, { opPrefix: 'Waiting for tunnels to be created' })

    return { envId, machine, tunnels }
  } finally {
    sshClient.dispose()
  }
}

export default up
