import { detectCiProvider } from './ci-providers'
import { gitBranchName } from './git'
import { truncateWithHash } from './strings'
import { ComposeModel } from './compose'
import { Logger } from './log'

const MAX_PROJECT_NAME_LENGTH = 30
const MAX_ENV_ID_LENGTH = 52

const normalizeChars = (s: string) => s
  .toLowerCase()
  .replace(/[^a-z0-9_-]/g, '-')
  .replace(/^[^a-z]/, firstChar => `a${firstChar}`) // prepend alpha char if first char is not alpha

const normalize = (s: string, maxLength: number) => truncateWithHash(
  normalizeChars(s),
  maxLength,
).toLowerCase()

const envIdFromBranch = (branch: string) => normalizeChars(branch)

export class AmbientEnvIdNotFoundError extends Error {
  constructor() {
    super('Cannot find an ambient environment ID')
  }
}

export class InvalidIdentifierError extends Error {
  constructor(readonly value: string, readonly maxLength: number, readonly fieldDescription: string) {
    super(`Invalid ${fieldDescription} "${value}". Can only contain lowercase letters, numeric characters, underscores and dashes. The value can be at most ${maxLength} characters long.`)
  }
}

const validateUserSpecifiedValue = (
  { value, maxLength, fieldDescription }: { value: string; maxLength: number; fieldDescription: string },
) => {
  if (normalize(value, maxLength) !== value) {
    throw new InvalidIdentifierError(value, maxLength, fieldDescription)
  }
  return { value, basedOn: `user specified ${fieldDescription}` }
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
  const suffix = await findAmbientEnvIdSuffix()
  return {
    value: normalize(
      [projectName, suffix.value].join('-'),
      MAX_ENV_ID_LENGTH
    ),
    basedOn: suffix.basedOn,
  }
}

const findNormalizedProjectName = (
  { userSpecifiedProjectName, userModel }: {
    userSpecifiedProjectName?: string
    userModel: Pick<ComposeModel, 'name'>
  },
) => (
  userSpecifiedProjectName
    ? validateUserSpecifiedValue({ value: userSpecifiedProjectName, maxLength: MAX_PROJECT_NAME_LENGTH, fieldDescription: 'project name' })
    : {
      value: normalize(userModel.name, MAX_PROJECT_NAME_LENGTH),
      basedOn: 'Docker Compose file',
    }
)

export const findEnvId = async (
  { userSpecifiedProjectName, userModel, userSpecifiedEnvId, log }: {
    userSpecifiedProjectName: string | undefined
    userSpecifiedEnvId: string | undefined
    userModel: Pick<ComposeModel, 'name'> | (() => Promise<Pick<ComposeModel, 'name'>>)
    log?: Logger['info']
  },
): Promise<{ envId: string; normalizedProjectName: string; basedOn: string }> => {
  const normalizedProjectName = findNormalizedProjectName({
    userSpecifiedProjectName,
    userModel: typeof userModel === 'function' ? await userModel() : userModel,
  })

  const envId = userSpecifiedEnvId
    ? validateUserSpecifiedValue({ value: userSpecifiedEnvId, maxLength: MAX_ENV_ID_LENGTH, fieldDescription: 'environment ID' })
    : await findAmbientEnvId(normalizedProjectName.value)

  const basedOn = userSpecifiedEnvId ? envId.basedOn : `project name from ${normalizedProjectName.basedOn}, suffix from ${envId.basedOn}`
  log?.(`Environment ID based on: ${basedOn}`)
  log?.(`Environment ID: ${envId.value}`)
  return {
    envId: envId.value,
    normalizedProjectName: normalizedProjectName.value,
    basedOn,
  }
}
