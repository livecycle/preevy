import { MachineStatusCommand, ScriptInjection } from '@preevy/common'
import yaml from 'yaml'
import { TunnelOpts } from '../ssh/index.js'
import { ComposeModel, composeModelFilename, localComposeClient } from '../compose/index.js'
import { dockerEnvContext } from '../docker.js'
import { MachineConnection } from '../driver/index.js'
import { remoteProjectDir } from '../remote-files.js'
import { Logger } from '../log.js'
import { FileToCopy, uploadWithSpinner } from '../upload-files/index.js'
import { EnvId } from '../env-id.js'
import { BuildSpec } from '../build/index.js'
import modelCommand from './model.js'
import buildCommand from './build.js'
import { CommandExecuter } from '../command-executer.js'
import { telemetryEmitter } from '../telemetry/index.js'
import { measureTime } from '../timing.js'
import { imageTagCalculator } from '../build/image-tag.js'
import { gitContext } from '../git.js'
import { localFs } from '../index.js'

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
  volumeSkipList,
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
  modelFilter,
}: {
  debug: boolean
  machineStatusCommand?: MachineStatusCommand
  userAndGroup: [string, string]
  dockerPlatform: string
  connection: Pick<MachineConnection, 'exec' | 'dockerSocket'>
  tunnelOpts: TunnelOpts
  userSpecifiedProjectName: string | undefined
  userSpecifiedServices: string[]
  volumeSkipList: string[]
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
  modelFilter: (userModel: ComposeModel) => Promise<ComposeModel>
}) => {
  const remoteDir = remoteProjectDir(projectName)

  const {
    model,
    filesToCopy,
    skippedVolumes,
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
    volumeSkipList,
    scriptInjections,
    version,
    envId,
    allowedSshHostKeys,
    composeFiles,
    dataDir,
    expectedServiceUrls,
    projectName,
    sshTunnelPrivateKey,
    modelFilter,
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
      imageTagCalculator: imageTagCalculator({
        gitContext,
        fsReader: localFs('/'),
      }),
    })).deployModel
  }

  skippedVolumes.forEach(({ service, source, matchingRule }) => {
    log.info(`Not copying volume "${source}" for service "${service}" because it matched skip glob "${matchingRule}"`)
  })

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

  const { elapsedTimeSec } = await measureTime(() => compose.spawnPromise(composeArgs, { stdio: 'inherit', env: dockerContext.env }))
  telemetryEmitter().capture('deploy success', {
    elapsed_sec: elapsedTimeSec,
    with_build: Boolean(buildSpec),
    has_registry: Boolean(buildSpec?.registry),
  })
  log.info(`Deploy step done in ${elapsedTimeSec.toLocaleString(undefined, { maximumFractionDigits: 2 })}s`)

  return { composeModel, projectLocalDataDir }
}

export default up
