export type CiProvider = {
  name: string
  telemetryId: string
  currentlyRunningInProvider: () => boolean
  branchName: () => string | undefined
  pullRequestNumber: () => number | undefined
  repoUrl: () => string | undefined
}
