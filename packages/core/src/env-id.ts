import { detectCiProvider } from './ci-providers'
import { gitBranchName } from './git'
import { ComposeModel } from './compose'
import { Logger } from './log'

const normalize = (s: string) => s
  .toLowerCase()
  .replace(/[^a-z0-9_-]/g, '-')
  .replace(/^[^a-z]/, firstChar => `a${firstChar}`) // prepend alpha char if first char is not alpha

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
  return value
}

const findAmbientEnvIdSuffix = async () => {
  const ciProvider = detectCiProvider()
  if (ciProvider) {
    const branch = ciProvider.branchName()
    if (branch) {
      return { value: envIdFromBranch(branch), basedOn: 'CI branch' }
    }
  }
  const branch = await gitBranchName()
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

export async function findEnvId(args: {
  log: Logger
  userSpecifiedEnvId: string | undefined
  projectName: string
  projectNameBasedOn?: string
}): Promise<{ envId: string }>
export async function findEnvId(args: {
  log: Logger
  userSpecifiedEnvId: string | undefined
  userSpecifiedProjectName: string | undefined
  userModel: ComposeModel | (() => Promise<ComposeModel>)
}): Promise<{ envId: string; projectName: string }>
export async function findEnvId({ log, userSpecifiedEnvId, ...args }: {
  log: Logger
  userSpecifiedEnvId: string | undefined
} & (
  { projectName: string; projectNameBasedOn?: string }
  | { userSpecifiedProjectName: string | undefined; userModel: ComposeModel | (() => Promise<ComposeModel>) }
)) {
  if (userSpecifiedEnvId) {
    log.info(`Using user specified environment ID ${userSpecifiedEnvId}`)
    return {
      envId: validateUserSpecifiedValue({ value: userSpecifiedEnvId, fieldDescription: 'environment ID' }),
    }
  }

  const { projectName, projectNameBasedOn } = 'projectName' in args
    ? args
    : await findProjectName(args)

  const { value: envId, basedOn } = await findAmbientEnvId(projectName)

  const envIdBaseOn = [
    projectNameBasedOn ? 'user specified project name' : 'project name from Docker Compose',
    basedOn,
  ].join(' and ')

  log.info(`Using environment ID ${envId}, based on ${envIdBaseOn}`)
  return {
    envId,
    ...'projectName' in args ? {} : { projectName },
  }
}
