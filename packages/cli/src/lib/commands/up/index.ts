import { randomBytes } from 'crypto'
import { inspect, promisify } from 'util'
import childProcess from 'child_process'
import fs from 'fs'
import retry from 'p-retry';
import yaml from 'yaml'
import { Logger } from "../../../log";
import { Machine, MachineDriver, scripts } from "../../machine";
import { CommandResult, nodeSshClient, SshClient } from "../../ssh/client";
import { NamedSshKeyPair, SshKeyPair } from "../../ssh/keypair";
import { PersistentState } from "../../state";
import path from 'path';
import { addDockerProxyService, ComposeModel, fixModelForRemote } from '../../compose';
import { DOCKER_PROXY_DIR } from '../../../static';
import { TunnelOpts } from '../../ssh/url';

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

    // const env = instanceScriptEnvFromTunnelOpts(tunnelOpts)
    for (const script of scripts.INSTANCE_SPECIFIC) {
      await execScript(script)
    }

    // const tunnelId = await getTunnelId({ sshClient });
    // log.debug(`Tunnel id: ${tunnelId}`)

    const appDir = '/var/run/preview'
    await sshClient.execCommand(`sudo rm -rf "${appDir}" && sudo mkdir -p "${appDir}" && sudo chown $USER:docker "${appDir}"`)

    log.debug('Normalizing compose files')
    composeFiles = composeFiles || []

    const composeFileArgs = composeFiles.flatMap(file => ['-f', file]);

    const model = await withDockerSocket({ sshClient, log, dataDir }, async () => {
      const command = `docker compose ${composeFileArgs.join(' ')} convert`
      const { stdout } = await exec(command)
      return yaml.parse(stdout) as ComposeModel
    })

    let { model: remoteModel, filesToCopy } = fixModelForRemote({ 
      appDir, 
      localDir: process.cwd(),
    }, model)

    log.debug('model', yaml.stringify(remoteModel))

    log.info('Copying files')

    log.debug('Files to copy', filesToCopy)

    await sshClient.putFiles(filesToCopy)


    addDockerProxyService({
      tunnelOpts, buildDir: DOCKER_PROXY_DIR, port: DOCKER_PROXY_PORT,
    }, remoteModel)

    const composeFilePath = path.join(dataDir, 'docker-compose.yml')
    await fs.promises.writeFile(composeFilePath, yaml.stringify(remoteModel))

    log.debug('Running compose up')

    await withDockerSocket({ sshClient: sshClient, log, dataDir }, async () => {
      const compose = childProcess.spawn(
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
      )

      // compose.stdout.pipe(process.stdout)
      // compose.stderr.pipe(process.stderr)
      
      await new Promise<void>((resolve, reject) => {
        compose.on('exit', (code, signal) => {
          if (code !== 0) {
            const message = `docker-compose exited with code ${code}${signal ? `and signal ${signal}` : ''}`;
            log.error(message)
            reject(new Error(message))
            return
          }
          resolve()
        })
      })
    })

    log.info('Getting tunnels')

    const tunnels = JSON.parse((await sshClient.execCommand(`curl -sf http://$(docker compose port preview_proxy 3000)/tunnels`)).stdout)
    const tunnelId = JSON.parse((await sshClient.execCommand(`curl -sf http://$(docker compose port preview_proxy 3000)/client-id`)).stdout)

    return { machine, keyPair, tunnelId, tunnels }
  } finally {
    sshClient.dispose()
  }
}

export default up
