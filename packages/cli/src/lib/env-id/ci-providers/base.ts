export type CiProvider = {
  currentlyRunningInProvider: () => boolean
  branchName: () => string | undefined
  pullRequestNumber: () => number | undefined
}
