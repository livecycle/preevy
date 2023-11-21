import { MachineStatusCommand, ScriptInjection } from '@preevy/common'
import path from 'path'
import { rimraf } from 'rimraf'
import { TunnelOpts } from '../ssh'
import { remoteComposeModel } from '../compose'
import { createCopiedFileInDataDir } from '../remote-files'
import { Logger } from '../log'
import { EnvId } from '../env-id'

const composeModel = async ({
  debug,
  machineStatusCommand,
  userAndGroup,
  tunnelOpts,
  userSpecifiedProjectName,
  userSpecifiedServices,
  scriptInjections,
  composeFiles,
  log,
  dataDir,
  allowedSshHostKeys: hostKey,
  sshTunnelPrivateKey,
  cwd,
  version,
  envId,
  expectedServiceUrls,
  projectName,
}: {
  debug: boolean
  machineStatusCommand?: MachineStatusCommand
  userAndGroup: [string, string]
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
  version: string
  envId: EnvId
  expectedServiceUrls: { name: string; port: number; url: string }[]
  projectName: string
}) => {
  const projectLocalDataDir = path.join(dataDir, projectName)
  await rimraf(projectLocalDataDir)

  const createCopiedFile = createCopiedFileInDataDir({ projectLocalDataDir })

  const remoteModel = await remoteComposeModel({
    debug,
    userSpecifiedProjectName,
    userSpecifiedServices,
    composeFiles,
    log,
    cwd,
    expectedServiceUrls,
    projectName,
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
