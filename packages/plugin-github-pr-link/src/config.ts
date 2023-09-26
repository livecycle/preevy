import { defaults } from 'lodash'
import fs from 'fs'
import { Config as OclifConfig } from '@oclif/core'
import { Logger, detectCiProvider, gitContext } from '@preevy/core'
import { tryParseRepo, tryParseUrlToRepo } from './repo'
import { ParsedFlags, flagsDef, prefixedFlagsDef } from './flags'
import { defaultCommentTemplate } from './lib/github-comment'

export type PluginConfig = {
  repo?: string
  token?: string
  pullRequest?: number
  commentTemplate?: string
  detect?: boolean
}

export type GithubConfig = {
  repo: { owner: string; repo: string }
  token: string
  commentTemplate: string
  pullRequest: number
}

type GithubConfigProp = keyof GithubConfig

const githubConfigProps: readonly GithubConfigProp[] = [
  'commentTemplate',
  'repo',
  'token',
  'pullRequest',
] as const

export const missingGithubConfigProps = (
  config: Partial<GithubConfig>,
): GithubConfigProp[] => githubConfigProps.filter(prop => !config[prop])

const ambientGithubConfig = async ({ log }: { log: Logger }): Promise<Partial<GithubConfig>> => {
  log.debug('ambientGithubConfig, have GITHUB_TOKEN: %j', Boolean(process.env.GITHUB_TOKEN))
  const result: Partial<GithubConfig> = {
    token: process.env.GITHUB_TOKEN,
  }

  const ciProvider = detectCiProvider()
  log.debug('ambientGithubConfig, ciProvider: %j', ciProvider?.name)

  result.pullRequest = ciProvider?.pullRequestNumber()

  log.debug('ambientGithubConfig, ciProvider: %j', ciProvider?.name)

  const repoUrlStr = ciProvider?.repoUrl() ?? await gitContext().remoteTrackingBranchUrl().catch(() => undefined)

  log.debug('ambientGithubConfig, repoUrlStr: %j', repoUrlStr)

  if (repoUrlStr) {
    result.repo = tryParseUrlToRepo(repoUrlStr)
    log.debug('ambientGithubConfig, repoUrl: %j', result.repo)
  }

  return result
}

const readFromFile = (path?: string) => path && fs.promises.readFile(path, { encoding: 'utf-8' })

const githubConfigFromPrefixedFlags = async (
  flags: ParsedFlags<typeof prefixedFlagsDef>,
): Promise<Partial<GithubConfig>> => ({
  pullRequest: flags['github-pr-link-pull-request'],
  repo: flags['github-pr-link-repo'],
  token: flags['github-pr-link-token'],
  commentTemplate: await readFromFile(flags['github-pr-link-comment-template-file']),
})

export const githubConfigFromFlags = async (
  flags: ParsedFlags<typeof flagsDef>,
): Promise<Partial<GithubConfig>> => ({
  pullRequest: flags['pull-request'],
  repo: flags.repo,
  token: flags.token,
  commentTemplate: await readFromFile(flags['comment-template-file']),
})

const githubConfigFromPluginConfig = (config: PluginConfig): Partial<GithubConfig> => ({
  pullRequest: config.pullRequest,
  token: config.token,
  repo: config.repo ? tryParseRepo(config.repo) : undefined,
  commentTemplate: config.commentTemplate,
})

export class IncompleteGithubConfig extends Error {
  constructor(readonly missingProps: readonly GithubConfigProp[]) {
    super(`Incomplete github config: Missing required properties: ${missingProps.join(', ')}`)
  }
}

const mergeGithubConfig = async (
  factories: ((() => Partial<GithubConfig>) | (() => Promise<Partial<GithubConfig>>))[],
  { log }: { log: Logger }
) => {
  let result: Partial<GithubConfig> = {}
  let missingProps: readonly GithubConfigProp[] = githubConfigProps

  let factoryIndex = -1
  for (const factory of factories) {
    factoryIndex += 1
    // eslint-disable-next-line no-await-in-loop
    const factoryResult = await factory()
    log.debug('Merging github config with factory %i: %j', factoryIndex, factoryResult)
    result = defaults(result, factoryResult)
    missingProps = missingGithubConfigProps(result)
    if (missingProps.length === 0) {
      return result as GithubConfig
    }
  }

  throw new IncompleteGithubConfig(missingProps)
}

export const loadGithubConfig = async (
  config: PluginConfig,
  fromFlags: Partial<GithubConfig>,
  { log }: { log: Logger }
): Promise<GithubConfig> => {
  const shouldDetect = config.detect === undefined || config.detect

  return await mergeGithubConfig([
    () => fromFlags,
    () => githubConfigFromPluginConfig(config),
    ...shouldDetect ? [() => ambientGithubConfig({ log })] : [],
    () => ({ commentTemplate: defaultCommentTemplate }),
  ], { log })
}

const SCOPED_ENV_VAR = 'GITHUB_LINK'

export const loadGithubConfigOrSkip = async (
  oclifConfig: Pick<OclifConfig, 'scopedEnvVar' | 'scopedEnvVarTrue'>,
  pluginConfig: PluginConfig,
  flags: ParsedFlags<typeof prefixedFlagsDef>,
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

  return await loadGithubConfig(pluginConfig, await githubConfigFromPrefixedFlags(flags), { log })
}
