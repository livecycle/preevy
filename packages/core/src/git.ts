import { execPromiseStdout } from './child-process'

export const gitBranchName = async () => await execPromiseStdout('git rev-parse --abbrev-ref HEAD')
  .catch(() => undefined)

export const gitRemoteTrackingBranchUrl = async (localBranch?: string) => {
  const b = localBranch ?? await execPromiseStdout('git name-rev --name-only HEAD')
  const trackingRemote = await execPromiseStdout(`git config branch.${b}.remote`)
  return await execPromiseStdout(`git config remote.${trackingRemote}.url`)
}
