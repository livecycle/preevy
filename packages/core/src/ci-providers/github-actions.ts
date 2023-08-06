import fs from 'fs'
import { CiProvider } from './base'
import { stringOrUndefinedToNumber } from './common'

const readEventPayload = () => (
  process.env.GITHUB_EVENT_PATH
    ? JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, { encoding: 'utf8' }))
    : undefined
)

// https://docs.github.com/en/actions/learn-github-actions/variables#default-environment-variables
export const githubActionsCiProvider = (): CiProvider => ({
  name: 'GitHub Actions',
  telemetryId: 'gha',
  currentlyRunningInProvider: () => Boolean(process.env.CI && process.env.GITHUB_ACTIONS),
  branchName: () => process.env.GITHUB_HEAD_REF,
  pullRequestNumber: () => stringOrUndefinedToNumber(
    process.env.GITHUB_REF?.match(/^refs\/pull\/(\d+)/)?.[1],
  ),
  gitCommit: () => readEventPayload()?.pull_request?.head?.sha ?? process.env.GITHUB_SHA as string,
  repoUrl: () => (
    (process.env.GITHUB_REPOSITORY && process.env.GITHUB_SERVER_URL)
      ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}.git`
      : undefined
  ),
})
