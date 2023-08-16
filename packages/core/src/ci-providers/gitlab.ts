import { CiProvider } from './base'
import { stringOrUndefinedToNumber } from './common'

// https://docs.gitlab.com/ee/ci/variables/predefined_variables.html
export const gitlabActionsCiProvider = (): CiProvider => ({
  name: 'GitLab',
  id: 'gitlab',
  currentlyRunningInProvider: () => Boolean(process.env.CI && process.env.GITLAB_CI),
  branchName: () => process.env.CI_COMMIT_BRANCH
    || process.env.CI_MERGE_REQUEST_SOURCE_BRANCH_NAME
    || process.env.CI_COMMIT_REF_NAME,
  gitCommit: () => process.env.CI_COMMIT_SHA as string,
  pullRequestNumber: () => stringOrUndefinedToNumber(
    process.env.CI_MERGE_REQUEST_IID || process.env.CI_EXTERNAL_PULL_REQUEST_IID
  ),
  repoUrl: () => process.env.CI_REPOSITORY_URL,
})
