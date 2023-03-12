import fs from 'fs'
import retry from 'p-retry'
import yaml from 'yaml'
import path from 'path'
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

const DOCKER_PROXY_SERVICE_NAME = 'preview_proxy'

const up = async ({
  machineDriver,
  tunnelOpts,
  envId,
  log,
  composeFiles: userComposeFiles,
  dataDir,
  projectDir,
  sshKey,
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
}): Promise<{ machine: Machine; tunnels: Tunnel[] }> => {
  log.debug('Normalizing compose files')

  const userModel = await dockerCompose(...userComposeFiles || []).getModel()
  const remoteDir = path.join(REMOTE_DIR_BASE, userModel.name)

  const { model: fixedModel, filesToCopy } = fixModelForRemote({
    remoteDir,
    localDir: projectDir,
  }, userModel)

  const remoteModel = addDockerProxyService({
    tunnelOpts,
    buildDir: DOCKER_PROXY_DIR,
    port: DOCKER_PROXY_PORT,
    serviceName: DOCKER_PROXY_SERVICE_NAME,
    sshPrivateKey: sshTunnelPrivateKey,
  }, fixedModel)

  log.debug('model', yaml.stringify(remoteModel))
  const projectLocalDataDir = path.join(dataDir, userModel.name)
  await fs.promises.mkdir(projectLocalDataDir, { recursive: true })
  const composeFilePath = path.join(projectLocalDataDir, 'docker-compose.yml')
  await fs.promises.writeFile(composeFilePath, yaml.stringify(remoteModel), { flag: 'w' })

  // though not needed, it's useful for debugging to have the compose file at the remote machine
  filesToCopy.push({ local: composeFilePath, remote: 'docker-compose.yml' })

  const { machine, sshClient } = await ensureCustomizedMachine({ machineDriver, sshKey, envId, log })

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
