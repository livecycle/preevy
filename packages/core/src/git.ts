import { execPromiseStdout } from './child-process'

export const gitBranchName = async () => await execPromiseStdout('git rev-parse --abbrev-ref HEAD')
  .catch(() => undefined)

export const gitCommit = async () => await execPromiseStdout('git rev-parse HEAD')
  .catch(() => undefined)

export const gitAuthor = async (commit?: string) => {
  const [email, name] = await Promise.all([
    `git log -1 ${commit} --pretty=format:'%ae'`,
    `git log -1 ${commit} --pretty=format:'%an'`,
  ].map(cmd => execPromiseStdout(cmd).catch(() => undefined)))
  return email === undefined || name === undefined ? undefined : { name, email }
}

export const gitRemoteTrackingBranchUrl = async (localBranch?: string) => {
  const b = localBranch ?? (await execPromiseStdout('git rev-parse --abbrev-ref HEAD'))
  const trackingRemote = await execPromiseStdout(`git config branch.${b}.remote`)
  return await execPromiseStdout(`git config remote.${trackingRemote}.url`)
}
