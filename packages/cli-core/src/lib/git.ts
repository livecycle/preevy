import { execPromiseStdout } from './child-process'

export const gitBranchName = async () => execPromiseStdout('git rev-parse --abbrev-ref HEAD')
  .catch(() => undefined)
