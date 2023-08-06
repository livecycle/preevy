import * as git from './git'
import { detectCiProvider } from './ci-providers'

export type GitAuthor = { name: string; email: string }

export type GitMetadata = {
  branch?: string
  commit: string
  author: GitAuthor
  repoUrl?: string
  pullRequestNumber?: number
}

export type EnvMetadata = {
  git?: GitMetadata
}

const detectGitMetadata = async (): Promise<GitMetadata | undefined> => {
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

export const detectEnvMetadata = async (): Promise<EnvMetadata> => ({
  git: await detectGitMetadata(),
})
