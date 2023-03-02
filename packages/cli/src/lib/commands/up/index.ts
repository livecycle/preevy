import { randomBytes } from 'crypto'
import { promisify } from 'util'
import childProcess from 'child_process'
import fs from 'fs'
import retry from 'p-retry';
import yaml from 'yaml'
import shellEscape from 'shell-escape';
import { Logger } from "../../../log";
import { Machine, MachineDriver, scripts } from "../../machine";
import { CommandResult, nodeSshClient, SshClient } from "../../ssh/client";
import { NamedSshKeyPair, SshKeyPair } from "../../ssh/keypair";
import { PersistentState } from "../../state";
import path from 'path';
import { addDockerProxyService, ComposeModel, fixModelForRemote } from '../../compose';
import { DOCKER_PROXY_DIR } from '../../../static';
import { TunnelOpts } from '../../ssh/url';
import { spawnPromise } from '../../child-process';

const exec = promisify(childProcess.exec);

const ensureMachine = async ({
  machineDriver,
  envId,
  state,
  log,
}: {
  machineDriver: MachineDriver,
  envId: string,
  state: PersistentState,
  log: Logger,
}) => {
  const getFirstExistingKeyPair = async () => {
    for await (const keyPairName of machineDriver.listKeyPairs()) {
      const keyPair = await state.sshKeys.read(keyPairName)
      if (keyPair) {
        return Object.assign(keyPair, { name: keyPairName })
      }
    }
    return undefined
  }

  const createAndWriteKeyPair = async (): Promise<NamedSshKeyPair> => {
    log.info(`Creating key pair`)
    const keyPair = await machineDriver.createKeyPair({ envId })
    await state.sshKeys.write(keyPair.name, keyPair)
    return keyPair
  }

  const existingMachine = await machineDriver.getMachine({ envId })

  if (existingMachine) {
    const keyPair = await state.sshKeys.read(existingMachine.sshKeyName)
    if (keyPair) {
      return { machine: existingMachine, keyPair, installed: true }
    }

    log.info(`No matching key pair found for ${existingMachine.sshKeyName}, recreating machine`)
    machineDriver.removeMachine(existingMachine.providerId)
  }

  log.info(`Fetching key pair`)
  const keyPair = (await getFirstExistingKeyPair()) || (await createAndWriteKeyPair())
  log.info(`Creating machine`)
  const machine = await machineDriver.createMachine({ envId, keyPairName: keyPair.name })

  return { machine, keyPair, installed: machine.fromSnapshot }
}

type ScriptExecuter = (
  script: string, 
  opts?: { env?: Record<string, string | undefined> },
) => Promise<CommandResult>

const removeFileExtension = (f: string) => f.replace(/\.[^.]+$/, '')

const scriptExecuter = ({ sshClient, log } :{
  sshClient: SshClient,
  log: Logger,
}): ScriptExecuter => async (script, opts = {}) => {
  const destination = `/tmp/scripts/${removeFileExtension(script)}.${randomBytes(16).toString('hex') }`
  log.debug(`executing script ${script} at ${destination}`)
  await sshClient.putFiles([
    { local: path.join(scripts.DIR, script), remote: path.join(destination, script ) },
  ])
  try {
    return await sshClient.execCommand(`pwd; env; chmod +x ${script} && ./${script}`, { cwd: destination, env: opts.env })
  } finally {
    sshClient.execCommand(`rm -rf ${destination}`)
  }
}

// const instanceScriptEnvFromTunnelOpts = (tunnelOpts: TunnelOpts) => {
//   let [tunnelHost, tunnelPort] = tunnelOpts.url.split(':')
//   tunnelPort = tunnelPort || '443'

//   return {
//     SSH_HOSTNAME: tunnelHost,
//     SSH_PORT: tunnelPort,
//     SSH_USER: 'preview',
//     SSH_SERVERNAME: tunnelOpts.tlsServername || '',
//   }
// }

// const getTunnelId = async ({ sshClient }: { sshClient: SshClient }) => {
//   const { stdout } = await sshClient.execCommand('sudo preview_tunnel_meta')
//   const obj = JSON.parse(stdout)
//   if (typeof obj.clientId !== 'string') {
//     throw new Error(`Failed to get tunnel id: ${inspect(obj)}`)
//   }
//   return obj.clientId as string
// }

const withDockerSocket = async <Return>({ sshClient, log, dataDir }: {
    sshClient: SshClient,
    log: Logger,
    dataDir: string,
  },
  f: () => Promise<Return>,
): Promise<Return> => {
  const { localSocket, close } = await sshClient.forwardOutStreamLocal(
    '/var/run/docker.sock',
    { localDir: dataDir },
  )

  log.debug(`Local socket: ${localSocket}`)

  Object.keys(process.env).filter(k => k.startsWith('DOCKER_')).forEach(k => { delete process.env[k] })

  process.env.DOCKER_HOST = `unix://${localSocket}`

  return f().finally(close)
}

const DOCKER_PROXY_PORT = 3000
const DOCKER_PROXY_SERVICE_NAME = 'preview-proxy'

const queryDockerProxyTunnels = async ({ sshClient, log, dataDir, composeFilePath }: { 
  sshClient: SshClient 
  log: Logger
  dataDir: string
  composeFilePath: string
}) => {
  const dockerProxyUrl = await withDockerSocket({ sshClient, log, dataDir }, async () => {
    const command = `docker compose -f ${composeFilePath} port ${DOCKER_PROXY_SERVICE_NAME} ${DOCKER_PROXY_PORT}`
    const { stdout } = await exec(command)
    return stdout.trim()
  })

  const { tunnels, clientId: tunnelId } = await retry(async () => JSON.parse((
    await sshClient.execCommand(`curl -sf http://${dockerProxyUrl}/tunnels`)
  ).stdout), { minTimeout: 1000, maxTimeout: 1000, retries: 10 })

  return { tunnels, tunnelId }
}

const up = async ({
  machineDriver,
  tunnelOpts,
  envId,
  state,
  log,
  composeFiles,
  dataDir
}: { 
  machineDriver: MachineDriver,
  tunnelOpts: TunnelOpts,
  envId: string,
  state: PersistentState,
  log: Logger,
  composeFiles?: string[],
  dataDir: string
}): Promise<{ machine: Machine, keyPair: SshKeyPair, tunnelId: string, tunnels: Record<string, string> }> => {
  const { machine, keyPair, installed } = await ensureMachine({ machineDriver, envId, state, log })

  const sshClient = await retry(() => nodeSshClient({ 
    host: machine.publicIPAddress, 
    username: machine.sshUsername,
    privateKey: keyPair.privateKey.toString('utf-8'),
    log,
  }), { minTimeout: 2000, maxTimeout: 5000, retries: 10 })

  try {
    const execScript = scriptExecuter({ sshClient, log })

    if (!installed) {
      log.debug('Executing machine scripts')
      for (const script of scripts.CUSTOMIZE_BARE_MACHINE) {
        await execScript(script)
      }
      log.info('Creating snapshot')
      await machineDriver.ensureMachineSnapshot({ providerId: machine.providerId, envId })      
    }

    log.debug('Executing instance-specific scripts')

    for (const script of scripts.INSTANCE_SPECIFIC) {
      await execScript(script)
    }

    const remoteTempDir = (await sshClient.execCommand(`mktemp -d`)).stdout

    log.debug('Normalizing compose files')
    composeFiles = composeFiles || []

    const composeFileArgs = composeFiles.flatMap(file => ['-f', file]);

    const model = await withDockerSocket({ sshClient, log, dataDir }, async () => {
      const command = `docker compose ${shellEscape(composeFileArgs)} convert`
      const { stdout } = await exec(command)
      return yaml.parse(stdout) as ComposeModel
    })

    let { model: remoteModel, filesToCopy } = fixModelForRemote({ 
      remoteDir: remoteTempDir, 
      localDir: process.cwd(),
    }, model)

    log.debug('model', yaml.stringify(remoteModel))

    log.info('Copying files')

    log.debug('Files to copy', filesToCopy)

    await sshClient.putFiles(filesToCopy)
    const remoteDir = '/var/run/preview'

    // const hasRsync = (await sshClient.execCommand('which rsync', { ignoreExitCode: true })).code == 0

    await sshClient.execCommand(`sudo mkdir -p "${remoteDir}" && sudo chown $USER:docker "${remoteDir}"`)
    await sshClient.execCommand(`rsync -r "${remoteTempDir}/" "${remoteDir}"`)

    addDockerProxyService({
      tunnelOpts, 
      buildDir: DOCKER_PROXY_DIR, 
      port: DOCKER_PROXY_PORT,
      serviceName: DOCKER_PROXY_SERVICE_NAME,
      debug: true,
    }, remoteModel)

    const composeFilePath = path.join(dataDir, 'docker-compose.yml')
    await fs.promises.writeFile(composeFilePath, yaml.stringify(remoteModel))

    log.debug('Running compose up')

    await withDockerSocket({ sshClient: sshClient, log, dataDir }, () => spawnPromise(
      'docker',
      ['compose', '-f', composeFilePath, 'up', '-d'],
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
    const { tunnelId, tunnels } = await queryDockerProxyTunnels({ sshClient, log, dataDir, composeFilePath })

    return { machine, keyPair, tunnelId, tunnels }
  } finally {
    sshClient.dispose()
  }
}

export default up
