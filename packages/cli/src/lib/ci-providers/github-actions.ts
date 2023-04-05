import { CiProvider } from './base'
import { stringOrUndefinedToNumber } from './common'

// https://docs.github.com/en/actions/learn-github-actions/variables#default-environment-variables
export const githubActionsCiProvider = (): CiProvider => ({
  name: 'GitHub Actions',
  currentlyRunningInProvider: () => Boolean(process.env.CI && process.env.GITHUB_ACTIONS),
  branchName: () => process.env.GITHUB_HEAD_REF,
  pullRequestNumber: () => stringOrUndefinedToNumber(
    process.env.GITHUB_REF?.match(/^refs\/pull\/(\d+)/)?.[1],
  ),
})
