import { CiProvider } from './base'
import { stringOrUndefinedToNumber } from './common'

// https://docs.github.com/en/actions/learn-github-actions/variables#default-environment-variables
export const githubActionsCiProvider = (): CiProvider => ({
  name: 'GitHub Actions',
  telemetryId: 'gha',
  currentlyRunningInProvider: () => Boolean(process.env.CI && process.env.GITHUB_ACTIONS),
  branchName: () => process.env.GITHUB_HEAD_REF,
  pullRequestNumber: () => stringOrUndefinedToNumber(
    process.env.GITHUB_REF?.match(/^refs\/pull\/(\d+)/)?.[1],
  ),
  repoUrl: () => (
    (process.env.GITHUB_REPOSITORY && process.env.GITHUB_SERVER_URL)
      ? `https://${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}.git`
      : undefined
  ),
})
