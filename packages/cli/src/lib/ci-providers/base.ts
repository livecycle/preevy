export type CiProvider = {
  name: string
  currentlyRunningInProvider: () => boolean
  branchName: () => string | undefined
  pullRequestNumber: () => number | undefined
}
