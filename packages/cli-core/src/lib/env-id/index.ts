import { Flags } from '@oclif/core'
import { detectCiProvider } from '../ci-providers'
import { gitBranchName } from '../git'
import { ComposeClient } from '../compose/client'

const envIdFromBranch = (branch: string) => branch.replace(/[^a-zA-Z0-9]/g, '')

export class AmbientEnvIdNotFoundError extends Error {
  constructor() {
    super('Cannot find an ambient environment ID')
    this.name = 'AmbiendEnvIdNotFoundError'
  }
}

const findAmbientEnvIdSuffix = async (): Promise<string> => {
  const ciProvider = detectCiProvider()
  if (ciProvider) {
    const branch = ciProvider.branchName()
    if (branch) {
      return envIdFromBranch(branch)
    }
  }
  const branch = await gitBranchName()
  if (branch) {
    return envIdFromBranch(branch)
  }
  throw new AmbientEnvIdNotFoundError()
}

const envId = ({ projectName, suffix }: { projectName: string; suffix: string }) => `${projectName}-${suffix}`

export const findAmbientProjectName = async (composeClient: ComposeClient) => composeClient.getModelName()

export const findAmbientEnvId = async (projectName: string) => envId({
  projectName,
  suffix: await findAmbientEnvIdSuffix(),
})

export const envIdFlags = {
  id: Flags.string({
    description: 'Environment id - affects created URLs. If not specified, will try to detect automatically',
    required: false,
  }),
} as const
