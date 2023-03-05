import { promisify } from 'util'
import childProcess from 'child_process'
import fs from 'fs'
import retry from 'p-retry';
import yaml from 'yaml'
import { Logger } from "../../../log";
import { Machine, MachineDriver } from "../../machine";
import { FileToCopy, SshClient } from "../../ssh/client";
import { SshKeyPair } from "../../ssh/keypair";
import { PersistentState } from "../../state";
import path from 'path';
import { addDockerProxyService, fixModelForRemote } from '../../compose';
import { DOCKER_PROXY_DIR, DOCKER_PROXY_PORT } from '../../../static';
import { TunnelOpts } from '../../ssh/url';
import { spawnPromise } from '../../child-process';
import { ensureCustomizedMachine } from './machine';
import { wrapWithDockerSocket } from './docker';
import { getComposeModel, getComposeServiceUrl } from './compose-runner';

const exec = promisify(childProcess.exec);

const DOCKER_PROXY_SERVICE_NAME = 'preview-proxy'
const REMOTE_DIR_BASE = '/var/run/preview'

const queryTunnels = async (sshClient: SshClient, dockerProxyUrl: string) => {
  const { tunnels, clientId: tunnelId } = await retry(async () => JSON.parse((
    await sshClient.execCommand(`curl -sf http://${dockerProxyUrl}/tunnels`)
  ).stdout), { minTimeout: 1000, maxTimeout: 1000, retries: 10 })

  return { tunnels, tunnelId }
}

const copyFilesWithoutRecreatingDir = async (
  sshClient: SshClient, 
  remoteDir: string,
  filesToCopy: FileToCopy[],
) => {
  const remoteTempDir = (await sshClient.execCommand(`sudo mktemp -d -p "${REMOTE_DIR_BASE}"`)).stdout
  await sshClient.execCommand(`sudo chown $USER:docker "${remoteTempDir}"`)
  await sshClient.putFiles(
    filesToCopy.map(({ local, remote }) => ({ local, remote: path.join(remoteTempDir, remote) }))
  )
  await sshClient.execCommand(`rsync -a --delete "${remoteTempDir}/" "${remoteDir}" && sudo rm -rf "${remoteTempDir}"`)
}

const up = async ({
  machineDriver,
  tunnelOpts,
  envId,
  state,
  log,
  composeFiles,
  dataDir,
  projectDir,
}: { 
  machineDriver: MachineDriver,
  tunnelOpts: TunnelOpts,
  envId: string,
  state: PersistentState,
  log: Logger,
  composeFiles?: string[],
  dataDir: string
  projectDir: string
}): Promise<{ machine: Machine, keyPair: SshKeyPair, tunnelId: string, tunnels: Record<string, string> }> => {
  const { machine, keyPair, sshClient } = await ensureCustomizedMachine({ machineDriver, envId, state, log })
  const withDockerSocket = wrapWithDockerSocket({ sshClient, log, dataDir })

  try {
    log.debug('Normalizing compose files')

    const userModel = await getComposeModel(withDockerSocket, composeFiles || [])

    const projectLocalDataDir = path.join(dataDir, userModel.name)
    await fs.promises.mkdir(projectLocalDataDir, { recursive: true })

    const remoteDir = path.join(REMOTE_DIR_BASE, userModel.name)
    await sshClient.execCommand(`sudo mkdir -p "${remoteDir}" && sudo chown $USER:docker "${remoteDir}"`)

    const { model: remoteModel, filesToCopy } = fixModelForRemote({
      remoteDir, 
      localDir: projectDir,
    }, userModel)

    log.debug('model', yaml.stringify(remoteModel))

    log.debug('Files to copy', filesToCopy)

    log.info('Copying files')
    await copyFilesWithoutRecreatingDir(sshClient, remoteDir, filesToCopy)

    const composeFilePath = path.join(projectLocalDataDir, 'docker-compose.yml')

    await fs.promises.writeFile(
      composeFilePath, 
      yaml.stringify(addDockerProxyService({
        tunnelOpts,
        buildDir: DOCKER_PROXY_DIR,
        port: DOCKER_PROXY_PORT,
        serviceName: DOCKER_PROXY_SERVICE_NAME,
        debug: true,
      }, remoteModel)),
    )

    log.debug('Running compose up')

    await withDockerSocket(() => spawnPromise(
      'docker',
      ['compose', '-f', composeFilePath, 'up', '-d', '--remove-orphans'],
      { 
        env: {
          ...process.env,
          SSH_URL: tunnelOpts.url,
          TLS_SERVERNAME: tunnelOpts.tlsServername,
        },
        stdio: 'inherit',
      }
    ))

    log.info('Getting tunnels')

    const composeServiceUrl = await getComposeServiceUrl(
      withDockerSocket, 
      composeFilePath, 
      DOCKER_PROXY_SERVICE_NAME, 
      DOCKER_PROXY_PORT,
    )

    const { tunnelId, tunnels } = await queryTunnels(sshClient, composeServiceUrl)

    return { machine, keyPair, tunnelId, tunnels }
  } finally {
    sshClient.dispose()
  }
}

export default up
