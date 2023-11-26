import { execPromiseStdout } from './child-process'

export function gitContext(cwd: string = process.cwd()) {
  const execGit = async (command: string) => await execPromiseStdout(`git ${command}`, { cwd })
  const branchName = async () => await execGit('rev-parse --abbrev-ref HEAD')
    .catch(() => undefined)

  const head = async () => await execGit('rev-parse HEAD')
    .catch(() => undefined)

  const author = async (commit?: string) => {
    const [email, name] = await Promise.all([
      `log -1 ${commit} --pretty=format:'%ae'`,
      `log -1 ${commit} --pretty=format:'%an'`,
    ].map(cmd => execGit(cmd).catch(() => undefined)))
    return email === undefined || name === undefined ? undefined : { name, email }
  }

  const remoteTrackingBranchUrl = async (localBranch?: string) => {
    const b = localBranch ?? (await execGit('rev-parse --abbrev-ref HEAD'))
    const trackingRemote = await execGit(`config branch.${b}.remote || true`)
    if (!trackingRemote) {
      return undefined
    }
    return await execGit(`config remote.${trackingRemote}.url`)
  }

  return {
    branchName,
    commit: head,
    author,
    remoteTrackingBranchUrl,
  }
}

export type GitContext = ReturnType<typeof gitContext>
