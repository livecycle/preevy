import { MachineStatusCommand, ScriptInjection } from '@preevy/common'
import yaml from 'yaml'
import { TunnelOpts } from '../ssh'
import { composeModelFilename, localComposeClient } from '../compose'
import { dockerEnvContext } from '../docker'
import { MachineConnection } from '../driver'
import { remoteProjectDir } from '../remote-files'
import { Logger } from '../log'
import { FileToCopy, uploadWithSpinner } from '../upload-files'
import { EnvId } from '../env-id'
import { BuildSpec } from '../build'
import modelCommand from './model'
import buildCommand from './build'
import { CommandExecuter } from '../command-executer'

const uploadFiles = async ({
  log,
  filesToCopy,
  exec,
  skipUnchangedFiles,
  remoteDir,
}: {
  log: Logger
  filesToCopy: FileToCopy[]
  exec: CommandExecuter
  skipUnchangedFiles: boolean
  remoteDir: string
}) => {
  await exec(`mkdir -p "${remoteDir}"`)

  log.debug('Files to copy', filesToCopy)

  await uploadWithSpinner(exec, remoteDir, filesToCopy, skipUnchangedFiles)
}

const up = async ({
  debug,
  machineStatusCommand,
  userAndGroup,
  dockerPlatform,
  connection,
  tunnelOpts,
  userSpecifiedProjectName,
  userSpecifiedServices,
  scriptInjections,
  composeFiles,
  log,
  dataDir,
  allowedSshHostKeys,
  sshTunnelPrivateKey,
  cwd,
  skipUnchangedFiles,
  version,
  envId,
  expectedServiceUrls,
  projectName,
  buildSpec,
}: {
  debug: boolean
  machineStatusCommand?: MachineStatusCommand
  userAndGroup: [string, string]
  dockerPlatform: string
  connection: Pick<MachineConnection, 'exec' | 'dockerSocket'>
  tunnelOpts: TunnelOpts
  userSpecifiedProjectName: string | undefined
  userSpecifiedServices: string[]
  composeFiles: string[]
  log: Logger
  dataDir: string
  scriptInjections?: Record<string, ScriptInjection>
  sshTunnelPrivateKey: string | Buffer
  allowedSshHostKeys: Buffer
  cwd: string
  skipUnchangedFiles: boolean
  version: string
  envId: EnvId
  expectedServiceUrls: { name: string; port: number; url: string }[]
  projectName: string
  buildSpec?: BuildSpec
}) => {
  const remoteDir = remoteProjectDir(projectName)

  const {
    model,
    filesToCopy,
    projectLocalDataDir,
    createCopiedFile,
  } = await modelCommand({
    debug,
    log,
    machineStatusCommand,
    userAndGroup,
    cwd,
    tunnelOpts,
    userSpecifiedProjectName,
    userSpecifiedServices,
    scriptInjections,
    version,
    envId,
    allowedSshHostKeys,
    composeFiles,
    dataDir,
    expectedServiceUrls,
    projectName,
    sshTunnelPrivateKey,
  })

  log.debug('build spec: %j', buildSpec ?? 'none')

  let composeModel = model

  if (buildSpec) {
    await using dockerContext = await dockerEnvContext({ connection, log })

    composeModel = (await buildCommand({
      log,
      buildSpec,
      cwd,
      composeModel,
      projectLocalDataDir,
      machineDockerPlatform: dockerPlatform,
      env: dockerContext.env,
    })).deployModel
  }

  const modelStr = yaml.stringify(composeModel)
  log.debug('model', modelStr)
  const composeFilePath = await createCopiedFile(composeModelFilename, modelStr)
  filesToCopy.push(composeFilePath)

  await uploadFiles({ log, filesToCopy, exec: connection.exec, skipUnchangedFiles, remoteDir })

  const compose = localComposeClient({
    composeFiles: [composeFilePath.local],
    projectDirectory: cwd,
  })

  const composeArgs = [
    ...debug ? ['--verbose'] : [],
    'up', '-d', '--remove-orphans', '--no-build',
  ]

  log.info(`Running: docker compose up ${composeArgs.join(' ')}`)

  await using dockerContext = await dockerEnvContext({ connection, log })
  await compose.spawnPromise(composeArgs, { stdio: 'inherit', env: dockerContext.env })

  return { composeModel, projectLocalDataDir }
}

export default up
