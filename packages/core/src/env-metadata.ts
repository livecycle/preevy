import * as git from './git'
import { detectCiProvider } from './ci-providers'

export type GitAuthor = { name: string; email: string }

export type EnvGitMetadata = {
  ciProvider?: string
  branch?: string
  commit: string
  author: GitAuthor
  repoUrl?: string
  pullRequestNumber?: number
}

export const driverMetadataFilename = 'driver-metadata.json'

export type EnvDriverMetadata = {
  driver: string
  providerId: string
  opts: Record<string, unknown>
  machineLocationDescription: string
  creationTime: Date
}

export type EnvMetadata = {
  id: string
  git?: EnvGitMetadata
  driver?: EnvDriverMetadata
  lastDeployTime: Date
  version: string
}

const detectGitMetadata = async (): Promise<EnvGitMetadata | undefined> => {
  const ciProvider = detectCiProvider()
  const branch = await git.gitBranchName()
  if (!branch) {
    return undefined
  }
  const commit = ciProvider?.gitCommit() ?? await git.gitCommit() as string

  return {
    ciProvider: ciProvider?.id,
    branch: ciProvider?.branchName() ?? branch,
    commit,
    author: await git.gitAuthor(commit) as GitAuthor,
    pullRequestNumber: ciProvider?.pullRequestNumber(),
    repoUrl: ciProvider?.repoUrl() || await git.gitRemoteTrackingBranchUrl(),
  }
}

export const envMetadata = async ({ envId, version }: { envId: string; version: string }): Promise<Omit<EnvMetadata, 'driver'>> => ({
  id: envId,
  git: await detectGitMetadata(),
  lastDeployTime: new Date(),
  version,
})
