import { CiProvider } from './base.js'
import { stringOrUndefinedToNumber } from './common.js'

// https://support.atlassian.com/bitbucket-cloud/docs/variables-and-secrets/
export const bitbucketPipelinesCiProvider = (): CiProvider => ({
  name: 'Bitbucket Pipelines',
  id: 'bitbucket',
  currentlyRunningInProvider: () => Boolean(process.env.CI && process.env.BITBUCKET_BUILD_NUMBER),
  branchName: () => process.env.BITBUCKET_BRANCH || process.env.BITBUCKET_TAG,
  gitCommit: () => process.env.BITBUCKET_COMMIT as string,
  pullRequestNumber: () => stringOrUndefinedToNumber(
    process.env.BITBUCKET_PR_ID
  ),
  repoUrl: () => process.env.BITBUCKET_GIT_HTTP_ORIGIN,
})
