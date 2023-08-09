export type CiProvider = {
  name: string
  telemetryId: string
  currentlyRunningInProvider: () => boolean
  branchName: () => string | undefined
  gitCommit: () => string
  pullRequestNumber: () => number | undefined
  repoUrl: () => string | undefined
}
