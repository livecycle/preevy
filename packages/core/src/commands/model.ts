import { MachineStatusCommand, ScriptInjection } from '@preevy/common'
import path from 'path'
import { rimraf } from 'rimraf'
import { TunnelOpts } from '../ssh/index.js'
import { ComposeFiles, ComposeModel, remoteComposeModel } from '../compose/index.js'
import { createCopiedFileInDataDir } from '../remote-files.js'
import { Logger } from '../log.js'
import { EnvId } from '../env-id.js'

const composeModel = async ({
  debug,
  machineStatusCommand,
  userAndGroup,
  tunnelOpts,
  userSpecifiedProjectName,
  userSpecifiedServices,
  volumeSkipList,
  scriptInjections,
  composeFiles,
  log,
  dataDir,
  allowedSshHostKeys: hostKey,
  sshTunnelPrivateKey,
  version,
  envId,
  expectedServiceUrls,
  projectName,
  modelFilter,
}: {
  debug: boolean
  machineStatusCommand?: MachineStatusCommand
  userAndGroup: [string, string]
  tunnelOpts: TunnelOpts
  userSpecifiedProjectName: string | undefined
  userSpecifiedServices: string[]
  volumeSkipList: string[]
  composeFiles: ComposeFiles
  log: Logger
  dataDir: string
  scriptInjections?: Record<string, ScriptInjection>
  sshTunnelPrivateKey: string | Buffer
  allowedSshHostKeys: Buffer
  version: string
  envId: EnvId
  expectedServiceUrls: { name: string; port: number; url: string }[]
  projectName: string
  modelFilter: (userModel: ComposeModel) => Promise<ComposeModel>
}) => {
  const projectLocalDataDir = path.join(dataDir, projectName)
  await rimraf(projectLocalDataDir)

  const createCopiedFile = createCopiedFileInDataDir({ projectLocalDataDir })

  const remoteModel = await remoteComposeModel({
    debug,
    userSpecifiedProjectName,
    userSpecifiedServices,
    volumeSkipList,
    composeFiles,
    log,
    expectedServiceUrls,
    projectName,
    modelFilter,
    agentSettings: {
      allowedSshHostKeys: hostKey,
      sshTunnelPrivateKey,
      userAndGroup,
      createCopiedFile,
      envId,
      tunnelOpts,
      version,
      machineStatusCommand,
      scriptInjections,
    },
  })

  return { ...remoteModel, projectLocalDataDir, createCopiedFile }
}

export default composeModel
