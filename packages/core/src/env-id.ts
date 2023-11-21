import { detectCiProvider } from './ci-providers'
import { gitContext } from './git'
import { ComposeModel } from './compose/model'
import { Logger } from './log'

export type EnvId = string & {
  __tag: 'EnvId'
}

export const normalize = (s: string) => s
  .toLowerCase()
  .replace(/[^a-z0-9_-]/g, '-')
  .replace(/^[^a-z]/, firstChar => `a${firstChar}`) as EnvId // prepend alpha char if first char is not alpha

const envIdFromBranch = (branch: string) => normalize(branch)

export class AmbientEnvIdNotFoundError extends Error {
  constructor() {
    super('Cannot find an ambient environment ID. Either specify an environment ID or have a git context')
  }
}

export class InvalidIdentifierError extends Error {
  constructor(readonly value: string, readonly fieldDescription: string) {
    super(`Invalid ${fieldDescription} "${value}". Must start with a lowercase letter. Can only contain lowercase letters, digits, underscores and dashes.`)
  }
}

const validateUserSpecifiedValue = (
  { value, fieldDescription }: { value: string; fieldDescription: string },
) => {
  if (normalize(value) !== value) {
    throw new InvalidIdentifierError(value, fieldDescription)
  }
  return value as EnvId
}

export const validateEnvId = (envId:string) => validateUserSpecifiedValue({ value: envId, fieldDescription: 'environment ID' })

const findAmbientEnvIdSuffix = async () => {
  const ciProvider = detectCiProvider()
  if (ciProvider) {
    const branch = ciProvider.branchName()
    if (branch) {
      return { value: envIdFromBranch(branch), basedOn: 'CI branch' }
    }
  }
  const branch = await gitContext().branchName()
  if (branch) {
    return { value: envIdFromBranch(branch), basedOn: 'local git branch' }
  }
  throw new AmbientEnvIdNotFoundError()
}

const findAmbientEnvId = async (projectName: string) => {
  const { value: suffix, basedOn } = await findAmbientEnvIdSuffix()
  return {
    value: normalize([projectName, suffix].join('-')),
    basedOn,
  }
}

export const findProjectName = async ({ userSpecifiedProjectName, userModel }: {
  userSpecifiedProjectName: string | undefined
  userModel: ComposeModel | (() => Promise<ComposeModel>)
}): Promise<{ projectName: string; projectNameBasedOn?: string }> => {
  if (userSpecifiedProjectName) {
    return { projectName: userSpecifiedProjectName }
  }

  return {
    projectName: (typeof userModel === 'function' ? await userModel() : userModel).name,
    projectNameBasedOn: 'Docker Compose',
  }
}

export const findEnvIdByProjectName = async ({ log, projectName, projectNameBasedOn }: {
  log: Logger
  projectName: string
  projectNameBasedOn?: string
}) => {
  const { value: envId, basedOn } = await findAmbientEnvId(projectName)

  const envIdBaseOn = [
    projectNameBasedOn ? `project name from ${projectNameBasedOn}` : 'user specified project name',
    basedOn,
  ].join(' and ')

  log.info(`Using environment ID ${envId}, based on ${envIdBaseOn}`)
  return envId as EnvId
}

export async function findEnvId({ log, userSpecifiedEnvId, userSpecifiedProjectName, userModel }: {
  log: Logger
  userSpecifiedEnvId: string | undefined
  userSpecifiedProjectName: string | undefined
  userModel: ComposeModel | (() => Promise<ComposeModel>)
}): Promise<EnvId> {
  if (userSpecifiedEnvId) {
    log.debug(`Using user specified environment ID ${userSpecifiedEnvId}`)
    return validateEnvId(userSpecifiedEnvId)
  }

  const { projectName, projectNameBasedOn } = userSpecifiedProjectName
    ? { projectName: userSpecifiedProjectName, projectNameBasedOn: undefined }
    : await findProjectName({ userSpecifiedProjectName, userModel })

  return await findEnvIdByProjectName({ log, projectName, projectNameBasedOn })
}
