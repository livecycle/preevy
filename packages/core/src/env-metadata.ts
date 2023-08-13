import * as git from './git'
import { detectCiProvider } from './ci-providers'

export type GitAuthor = { name: string; email: string }

export type EnvGitMetadata = {
  branch?: string
  commit: string
  author: GitAuthor
  repoUrl?: string
  pullRequestNumber?: number
}

export const driverMetadataFilename = 'driver-metadata.json'

export type EnvDriverMetadata = {
  driver: string
  opts: Record<string, unknown>
  machineLocationDescription: string
  creationTime: Date
}

export type EnvMetadata = {
  git?: EnvGitMetadata
  driver: EnvDriverMetadata
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
    branch: ciProvider?.branchName() ?? branch,
    commit,
    author: await git.gitAuthor(commit) as GitAuthor,
    pullRequestNumber: ciProvider?.pullRequestNumber(),
    repoUrl: ciProvider?.repoUrl() || await git.gitRemoteTrackingBranchUrl(),
  }
}

export const envMetadata = async ({ version }: { version: string }): Promise<Omit<EnvMetadata, 'driver'>> => ({
  git: await detectGitMetadata(),
  lastDeployTime: new Date(),
  version,
})
