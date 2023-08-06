import { CiProvider } from './base'
import { nanToUndefined } from './common'

// https://docs.travis-ci.com/user/environment-variables/#default-environment-variables
export const travisCiProvider = (): CiProvider => ({
  name: 'Travis CI',
  telemetryId: 'travis',
  currentlyRunningInProvider: () => Boolean(process.env.CI && process.env.TRAVIS),
  branchName: () => (process.env.TRAVIS_TAG ? undefined : process.env.TRAVIS_BRANCH),
  gitCommit: () => process.env.TRAVIS_COMMIT as string,
  pullRequestNumber: () => (process.env.TRAVIS_PULL_REQUEST && process.env.TRAVIS_PULL_REQUEST !== 'false'
    ? nanToUndefined(Number(process.env.TRAVIS_PULL_REQUEST))
    : undefined),
  repoUrl: () => undefined,
})
