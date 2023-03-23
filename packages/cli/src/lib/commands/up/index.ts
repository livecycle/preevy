import fs from 'fs'
import retry from 'p-retry'
import yaml from 'yaml'
import path from 'path'
import ora from 'ora'
import { rimraf } from 'rimraf'
import { debounce } from 'lodash'
import { Logger } from '../../../log'
import { Machine, MachineDriver } from '../../machine'
import { ExpandedTransferProgress, FileToCopy, SshClient } from '../../ssh/client'
import { SSHKeyConfig } from '../../ssh/keypair'
import { fixModelForRemote } from '../../compose/model'
import { TunnelOpts } from '../../ssh/url'
import { ensureCustomizedMachine } from './machine'
import { wrapWithDockerSocket } from './docker'
import { localComposeClient } from '../../compose/client'
import { Tunnel } from '../../tunneling'
import { findAmbientEnvId } from '../../env-id'
import { DOCKER_PROXY_SERVICE_NAME, addDockerProxyService, findDockerProxyUrl, queryTunnels } from '../../docker-proxy-client'
import { ExpandedProgressConsumer } from '../../ssh/client/progress-expanded'
import { withSpinner } from '../../spinner'

const REMOTE_DIR_BASE = '/var/lib/preview'

const retryPipeError = <T>(log: Logger, f: () => T) => retry(f, {
  minTimeout: 500,
  maxTimeout: 2000,
  retries: 3,
  onFailedAttempt: (err: unknown) => {
    log.debug('Error in pipe attempt', err)
    if ((err as { code: unknown }).code !== 'EPIPE') {
      throw err
    }
  },
})

const queryTunnelsWithRetry = async (
  sshClient: SshClient,
  dockerProxyUrl: string,
  filterServices?: string[]
) => retry(
  () => queryTunnels(sshClient, dockerProxyUrl, filterServices),
  { minTimeout: 1000, maxTimeout: 2000, retries: 10 },
)

const displayWithUnit = (nbytes: number) => {
  if (nbytes < 1024) {
    return [nbytes, 'B']
  }
  if (nbytes < 1024 * 1024) {
    return [(nbytes / 1024).toFixed(1), 'KB']
  }
  if (nbytes < 1024 * 1024 * 1024) {
    return [(nbytes / 1024 / 1024).toFixed(1), 'MB']
  }
  return [(nbytes / 1024 / 1024 / 1024).toFixed(1), 'GB']
}

const SPINNER_PREFIX = 'Copying files:'

const showCopyFilesProgress = (
  spinner: ora.Ora,
  progress: ExpandedProgressConsumer,
) => {
  const text = ({
    bytes, totalBytes, files, totalFiles, currentFile, bytesPerSec,
  }: ExpandedTransferProgress) => `${SPINNER_PREFIX}: ${((bytes / totalBytes) * 100).toFixed(2)}% (${files}/${totalFiles}) ${displayWithUnit(bytesPerSec).join('')}/s ${currentFile}`
  progress.addListener(debounce((p: ExpandedTransferProgress) => { spinner.text = text(p) }, 100))
}

const copyFilesWithoutRecreatingDir = async (
  sshClient: SshClient,
  remoteDir: string,
  filesToCopy: FileToCopy[],
) => {
  const remoteTempDir = (await sshClient.execCommand(`sudo mktemp -d -p "${REMOTE_DIR_BASE}"`)).stdout.trim()
  await sshClient.execCommand(`sudo chown $USER:docker "${remoteTempDir}"`)
  const filesToCopyToTempDir = filesToCopy.map(
    ({ local, remote }) => ({ local, remote: path.join(remoteTempDir, remote) })
  )
  await withSpinner({ text: `${SPINNER_PREFIX}: Calculating...` }, async spinner => {
    const sftp = await sshClient.sftp({ concurrency: 1 })
    const progress = await sftp.putFilesWithExpandedProgress(filesToCopyToTempDir, { chunkSize: 128 * 1024 })
    showCopyFilesProgress(spinner, progress)
    await progress.done
    spinner.text = 'Finishing up...'
    await sshClient.execCommand(`rsync -ac --delete "${remoteTempDir}/" "${remoteDir}" && sudo rm -rf "${remoteTempDir}"`)
  })
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

  log.info(`Using envId: ${envId}`)

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

    await copyFilesWithoutRecreatingDir(sshClient, remoteDir, filesToCopy)

    const compose = localComposeClient([composeFilePath])

    log.debug('Running compose up')

    const upServices = userSpecifiedServices.length
      ? userSpecifiedServices.concat(DOCKER_PROXY_SERVICE_NAME)
      : []

    const composeArgs = [
      ...debug ? ['--verbose'] : [],
      'up', '-d', '--remove-orphans', '--build',
      ...upServices,
    ]

    log.debug('compose args: ', composeArgs)

    await retryPipeError(
      log,
      () => withDockerSocket(() => compose.spawnPromise(composeArgs, { stdio: 'inherit' })),
    )

    log.info('Getting tunnels')

    const dockerProxyServiceUrl = await withDockerSocket(() => findDockerProxyUrl(compose))

    const { tunnels } = await queryTunnelsWithRetry(
      sshClient,
      dockerProxyServiceUrl,
      userSpecifiedServices,
    )

    return { envId, machine, tunnels }
  } finally {
    sshClient.dispose()
  }
}

export default up
