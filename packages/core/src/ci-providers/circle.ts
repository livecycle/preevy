import { CiProvider } from './base'
import { extractPrNumberFromUrlPath, stringOrUndefinedToNumber } from './common'

// https://circleci.com/docs/variables/#built-in-environment-variables
export const circleCiProvider = (): CiProvider => ({
  name: 'CircleCI',
  telemetryId: 'circle',
  currentlyRunningInProvider: () => Boolean(process.env.CI === 'true' && process.env.CIRCLECI === 'true'),
  branchName: () => process.env.CIRCLE_BRANCH,
  pullRequestNumber: () => stringOrUndefinedToNumber(process.env.CIRCLE_PR_NUMBER)
    || extractPrNumberFromUrlPath(process.env.CIRCLE_PULL_REQUEST),
  repoUrl: () => process.env.CIRCLE_REPOSITORY_URL,
})
