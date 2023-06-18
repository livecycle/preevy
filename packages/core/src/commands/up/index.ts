import fs from 'fs'
import path from 'path'
import { rimraf } from 'rimraf'
import yaml from 'yaml'
import { formatPublicKey } from '@preevy/common'
import { inspect } from 'util'
import { TunnelOpts } from '../../ssh'
import { ComposeModel, fixModelForRemote, getExposedTcpServices, localComposeClient, resolveComposeFiles } from '../../compose'
import { ensureCustomizedMachine } from './machine'
import { wrapWithDockerSocket } from '../../docker'
import { findAmbientEnvId } from '../../env-id'
import { COMPOSE_TUNNEL_AGENT_SERVICE_NAME, addComposeTunnelAgentService, queryTunnels } from '../../compose-tunnel-agent-client'
import { withSpinner } from '../../spinner'
import { MachineCreationDriver, MachineDriver, MachineBase } from '../../driver'
import { remoteProjectDir } from '../../remote-files'
import { Logger } from '../../log'
import { Tunnel, tunnelUrlForEnv } from '../../tunneling'
import { FileToCopy, uploadWithSpinner } from '../../upload-files'

const createCopiedFileInDataDir = (
  { projectLocalDataDir, filesToCopy } : {
    projectLocalDataDir: string
    filesToCopy: FileToCopy[]
  }
) => async (
  filename: string,
  content: string | Buffer
): Promise<{ local: string; remote: string }> => {
  const local = path.join(projectLocalDataDir, filename)
  await fs.promises.mkdir(path.dirname(local), { recursive: true })
  await fs.promises.writeFile(local, content, { flag: 'w' })
  const result = { local, remote: filename }
  filesToCopy.push(result)
  return result
}

const calcComposeArgs = ({ userSpecifiedServices, debug, cwd } : {
  userSpecifiedServices: string[]
  debug: boolean
  cwd: string
}) => {
  const upServices = userSpecifiedServices.length
    ? userSpecifiedServices.concat(COMPOSE_TUNNEL_AGENT_SERVICE_NAME)
    : []

  return [
    ...debug ? ['--verbose'] : [],
    '--project-directory', cwd,
    'up', '-d', '--remove-orphans', '--build',
    ...upServices,
  ]
}

const serviceLinkEnvVars = (
  userModel: Pick<ComposeModel, 'services'>,
  tunnelUrlForService: (servicePort: { name: string; port: number }) => string,
) => getExposedTcpServices(userModel).reduce((envMapAgg, [service, port]) => ({
  ...envMapAgg,
  [`PREEVY_BASE_URI_${service}_${port}`.toUpperCase()]: tunnelUrlForService({ name: service, port }),
}), {})

const up = async ({
  clientId,
  baseUrl,
  debug,
  machineDriver,
  machineCreationDriver,
  tunnelOpts,
  userModel,
  userSpecifiedProjectName,
  userSpecifiedEnvId,
  userSpecifiedServices,
  userSpecifiedComposeFiles,
  systemComposeFiles,
  log,
  dataDir,
  allowedSshHostKeys: hostKey,
  sshTunnelPrivateKey,
  cwd,
  skipUnchangedFiles,
}: {
  clientId: string
  baseUrl: string
  debug: boolean
  machineDriver: MachineDriver
  machineCreationDriver: MachineCreationDriver
  tunnelOpts: TunnelOpts
  userModel: ComposeModel
  userSpecifiedProjectName: string | undefined
  userSpecifiedEnvId: string | undefined
  userSpecifiedServices: string[]
  userSpecifiedComposeFiles: string[]
  systemComposeFiles: string[]
  log: Logger
  dataDir: string
  sshTunnelPrivateKey: string | Buffer
  allowedSshHostKeys: Buffer
  cwd: string
  skipUnchangedFiles: boolean
}): Promise<{ machine: MachineBase; tunnels: Tunnel[]; envId: string }> => {
  const projectName = userSpecifiedProjectName ?? userModel.name
  const remoteDir = remoteProjectDir(projectName)

  const envId = userSpecifiedEnvId || await findAmbientEnvId(projectName)
  log.info(`Using environment ID: ${envId}`)

  // We start by getting the user model without injecting Preevy's environment
  // variables (e.g. `PREEVY_BASE_URI_BACKEND_3000`) so we can have the list of services
  // required to create said variables
  const tunnelUrlForService = tunnelUrlForEnv({ projectName, envId, baseUrl: new URL(baseUrl), clientId })
  const composeEnv = { ...serviceLinkEnvVars(userModel, tunnelUrlForService) }

  const composeFiles = await resolveComposeFiles({
    userSpecifiedFiles: userSpecifiedComposeFiles,
    systemFiles: systemComposeFiles,
  })

  log.debug(`Using compose files: ${composeFiles.join(', ')}`)

  // Now that we have the generated variables, we can create a new client and inject
  // them into it, to create the actual compose configurations
  const composeClientWithInjectedArgs = localComposeClient(
    { composeFiles, env: composeEnv, projectName: userSpecifiedProjectName }
  )

  const { model: fixedModel, filesToCopy } = await fixModelForRemote(
    { cwd, remoteBaseDir: remoteDir },
    await composeClientWithInjectedArgs.getModel()
  )

  const projectLocalDataDir = path.join(dataDir, projectName)
  await rimraf(projectLocalDataDir)

  const createCopiedFile = createCopiedFileInDataDir({ projectLocalDataDir, filesToCopy })
  const [sshPrivateKeyFile, knownServerPublicKey] = await Promise.all([
    createCopiedFile('tunnel_client_private_key', sshTunnelPrivateKey),
    createCopiedFile('tunnel_server_public_key', formatPublicKey(hostKey)),
  ])

  const { machine, connection } = await ensureCustomizedMachine({
    machineDriver, machineCreationDriver, envId, log, debug,
  })

  const { exec } = connection

  const composeTunnelAgentUser = (
    await exec('echo "$(id -u):$(stat -c %g /var/run/docker.sock)"')
  ).stdout.trim()

  const remoteModel = addComposeTunnelAgentService({
    debug,
    tunnelOpts,
    urlSuffix: envId,
    sshPrivateKeyPath: path.join(remoteDir, sshPrivateKeyFile.remote),
    knownServerPublicKeyPath: path.join(remoteDir, knownServerPublicKey.remote),
    user: composeTunnelAgentUser,
  }, fixedModel)

  const modelStr = yaml.stringify(remoteModel)
  log.debug('model', modelStr)
  const composeFilePath = (await createCopiedFile('docker-compose.yml', modelStr)).local

  const withDockerSocket = wrapWithDockerSocket({ connection, log })

  try {
    await exec(`sudo mkdir -p "${remoteDir}" && sudo chown $USER "${remoteDir}"`)

    log.debug('Files to copy', filesToCopy)

    await uploadWithSpinner(exec, remoteDir, filesToCopy, skipUnchangedFiles)

    const compose = localComposeClient({ composeFiles: [composeFilePath], projectName })
    const composeArgs = calcComposeArgs({ userSpecifiedServices, debug, cwd })
    log.debug('Running compose up with args: ', composeArgs)
    await withDockerSocket(() => compose.spawnPromise(composeArgs, { stdio: 'inherit' }))

    const tunnels = await withSpinner(async () => {
      const queryResult = await queryTunnels({
        tunnelUrlForService,
        retryOpts: {
          minTimeout: 1000,
          maxTimeout: 2000,
          retries: 10,
          onFailedAttempt: e => { log.debug(`Failed to create tunnel: ${inspect(e)}`) },
        },
      })

      return queryResult.tunnels
    }, { opPrefix: 'Waiting for tunnels to be created' })

    return { envId, machine, tunnels }
  } finally {
    await connection.close()
  }
}

export default up
