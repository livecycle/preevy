import { gitContext } from './git'
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

export type EnvMachineMetadata = {
  driver: string
  providerId: string
  opts: Record<string, unknown>
  locationDescription: string
  creationTime: Date
}

export type EnvMetadata = {
  id: string
  git?: EnvGitMetadata
  machine?: EnvMachineMetadata
  lastDeployTime: Date
  version: string
  profileThumbprint?: string
}

export const detectGitMetadata = async (workingDir: string): Promise<EnvGitMetadata | undefined> => {
  const git = gitContext(workingDir)
  const ciProvider = detectCiProvider()
  const branch = await git.branchName()
  if (!branch) {
    return undefined
  }
  const commit = ciProvider?.gitCommit() ?? await git.commit() as string

  return {
    ciProvider: ciProvider?.id,
    branch: ciProvider?.branchName() ?? branch,
    commit,
    author: await git.author(commit) as GitAuthor,
    pullRequestNumber: ciProvider?.pullRequestNumber(),
    repoUrl: ciProvider?.repoUrl() || await git.remoteTrackingBranchUrl(),
  }
}

export const envMetadata = async ({
  envId,
  version,
  profileThumbprint,
  workingDir = process.cwd(),
}: { envId: string; version: string; profileThumbprint?: string; workingDir?: string }): Promise<Omit<EnvMetadata, 'driver'>> => ({
  id: envId,
  git: await detectGitMetadata(workingDir),
  lastDeployTime: new Date(),
  version,
  profileThumbprint,
})
