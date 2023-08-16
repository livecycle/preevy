export type CiProvider = {
  name: string
  id: string
  currentlyRunningInProvider: () => boolean
  branchName: () => string | undefined
  gitCommit: () => string
  pullRequestNumber: () => number | undefined
  repoUrl: () => string | undefined
}
