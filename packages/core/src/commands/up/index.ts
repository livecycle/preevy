import { COMPOSE_TUNNEL_AGENT_SERVICE_NAME, formatPublicKey, readOrUndefined } from '@preevy/common'
import fs from 'fs'
import path from 'path'
import { rimraf } from 'rimraf'
import yaml from 'yaml'
import { TunnelOpts } from '../../ssh'
import { composeModelFilename, fixModelForRemote, localComposeClient, resolveComposeFiles } from '../../compose'
import { ensureCustomizedMachine } from './machine'
import { wrapWithDockerSocket } from '../../docker'
import { addComposeTunnelAgentService } from '../../compose-tunnel-agent-client'
import { MachineCreationDriver, MachineDriver, MachineBase } from '../../driver'
import { remoteProjectDir } from '../../remote-files'
import { Logger } from '../../log'
import { FileToCopy, uploadWithSpinner } from '../../upload-files'
import { envMetadata } from '../../env-metadata'
import { EnvId } from '../../env-id'

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
  const result = { local, remote: filename }
  if (await readOrUndefined(local) === Buffer.from(content)) {
    return result
  }
  await fs.promises.mkdir(path.dirname(local), { recursive: true })
  await fs.promises.writeFile(local, content, { flag: 'w' })
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
  expectedServiceUrls: { name: string; port: number; url: string }[],
) => Object.fromEntries(
  expectedServiceUrls
    .map(({ name, port, url }) => [`PREEVY_BASE_URI_${name.replace(/[^a-zA-Z0-9_]/g, '_')}_${port}`.toUpperCase(), url])
)

const up = async ({
  debug,
  machineDriver,
  machineDriverName,
  machineCreationDriver,
  tunnelOpts,
  userSpecifiedProjectName,
  userSpecifiedServices,
  userSpecifiedComposeFiles,
  systemComposeFiles,
  log,
  dataDir,
  allowedSshHostKeys: hostKey,
  sshTunnelPrivateKey,
  cwd,
  skipUnchangedFiles,
  version,
  envId,
  expectedServiceUrls,
  projectName,
}: {
  debug: boolean
  machineDriver: MachineDriver
  machineDriverName: string
  machineCreationDriver: MachineCreationDriver
  tunnelOpts: TunnelOpts
  userSpecifiedProjectName: string | undefined
  userSpecifiedServices: string[]
  userSpecifiedComposeFiles: string[]
  systemComposeFiles: string[]
  log: Logger
  dataDir: string
  sshTunnelPrivateKey: string | Buffer
  allowedSshHostKeys: Buffer
  cwd: string
  skipUnchangedFiles: boolean
  version: string
  envId: EnvId
  expectedServiceUrls: { name: string; port: number; url: string }[]
  projectName: string
}): Promise<{ machine: MachineBase }> => {
  const remoteDir = remoteProjectDir(projectName)

  const composeFiles = await resolveComposeFiles({
    userSpecifiedFiles: userSpecifiedComposeFiles,
    systemFiles: systemComposeFiles,
  })

  log.debug(`Using compose files: ${composeFiles.join(', ')}`)

  const composeClientWithInjectedArgs = localComposeClient({
    composeFiles,
    env: serviceLinkEnvVars(expectedServiceUrls),
    projectName: userSpecifiedProjectName,
  })

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

  const { machine, connection, userAndGroup } = await ensureCustomizedMachine({
    machineDriver, machineCreationDriver, machineDriverName, envId, log, debug,
  })

  try {
    const { exec } = connection

    const remoteModel = addComposeTunnelAgentService({
      envId,
      debug,
      tunnelOpts,
      sshPrivateKeyPath: path.join(remoteDir, sshPrivateKeyFile.remote),
      knownServerPublicKeyPath: path.join(remoteDir, knownServerPublicKey.remote),
      user: userAndGroup.join(':'),
      machineStatusCommand: await machineDriver.machineStatusCommand(machine),
      envMetadata: await envMetadata({ envId, version }),
      composeModelPath: path.join(remoteDir, composeModelFilename),
      privateMode: false,
      defaultAccess: 'public',
      composeProject: projectName,
    }, fixedModel)

    const modelStr = yaml.stringify(remoteModel)
    log.debug('model', modelStr)
    const composeFilePath = await createCopiedFile(composeModelFilename, modelStr)

    await exec(`mkdir -p "${remoteDir}"`)

    log.debug('Files to copy', filesToCopy)

    await uploadWithSpinner(exec, remoteDir, filesToCopy, skipUnchangedFiles)

    const compose = localComposeClient({
      composeFiles: [composeFilePath.local],
      projectName: userSpecifiedProjectName,
    })
    const composeArgs = calcComposeArgs({ userSpecifiedServices, debug, cwd })

    const withDockerSocket = wrapWithDockerSocket({ connection, log })

    log.info(`Running: docker compose up ${composeArgs.join(' ')}`)
    await withDockerSocket(() => compose.spawnPromise(composeArgs, { stdio: 'inherit' }))
  } finally {
    await connection.close()
  }

  return { machine }
}

export default up
