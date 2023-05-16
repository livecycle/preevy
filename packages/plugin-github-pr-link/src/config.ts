import { defaults } from 'lodash'
import { Config as OclifConfig } from '@oclif/core'
import { Logger, detectCiProvider, git } from '@preevy/core'
import { tryParseRepo, tryParseUrlToRepo } from './repo'
import { ParsedFlags } from './flags'

export type PluginConfig = {
  repo?: string
  token?: string
  pullRequest?: number
  detect?: boolean
}

export type GithubConfig = {
  repo: { owner: string; repo: string }
  token: string
  pullRequest: number
}

export const isCompleteGithubConfig = (
  config: Partial<GithubConfig>,
): config is GithubConfig => Boolean(config.repo && config.token && config.pullRequest)

const ambientGithubConfig = async (): Promise<Partial<GithubConfig>> => {
  const result: Partial<GithubConfig> = {
    token: process.env.GITHUB_TOKEN,
  }

  const ciProvider = detectCiProvider()

  result.pullRequest = ciProvider?.pullRequestNumber()

  const repoUrlStr = ciProvider?.repoUrl() ?? await git.gitRemoteTrackingBranchUrl().catch(() => undefined)

  if (repoUrlStr) {
    result.repo = tryParseUrlToRepo(repoUrlStr)
  }

  return result
}

const githubConfigFromFlags = (flags: ParsedFlags): Partial<GithubConfig> => ({
  pullRequest: flags['github-pr-link-pr'],
  repo: flags['github-pr-link-repo'],
  token: flags['github-pr-link-token'],
})

const githubConfigFromPluginConfig = (config: PluginConfig): Partial<GithubConfig> => ({
  pullRequest: config.pullRequest,
  token: config.token,
  repo: config.repo ? tryParseRepo(config.repo) : undefined,
})

export const loadGithubConfig = async (
  config: PluginConfig,
  flags: ParsedFlags,
): Promise<GithubConfig | undefined> => {
  let result = defaults(
    {},
    githubConfigFromPluginConfig(config),
    githubConfigFromFlags(flags),
  )

  if (config.detect === undefined || config.detect) {
    result = defaults(result, await ambientGithubConfig())
  }

  if (!isCompleteGithubConfig(result)) {
    return undefined
  }

  return result
}

const SCOPED_ENV_VAR = 'GITHUB_LINK'

export const loadGithubConfigOrSkip = async (
  oclifConfig: Pick<OclifConfig, 'scopedEnvVar' | 'scopedEnvVarTrue'>,
  pluginConfig: PluginConfig,
  flags: ParsedFlags,
  log: Logger,
) => {
  if (oclifConfig.scopedEnvVar(SCOPED_ENV_VAR) && !oclifConfig.scopedEnvVarTrue(SCOPED_ENV_VAR)) {
    log.debug('Skipping due to env var')
    return false
  }

  if (flags['github-pr-link-enabled'] === 'no') {
    log.debug('Skipping due to flag')
    return false
  }

  return loadGithubConfig(pluginConfig, flags)
}
