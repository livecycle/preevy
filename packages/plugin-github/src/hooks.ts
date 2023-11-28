import { HookFunc } from '@preevy/cli-common'
import { Octokit } from 'octokit'
import { Config as OclifConfig } from '@oclif/core/lib/interfaces'
import { Logger, detectCiProvider } from '@preevy/core'
import { memoize } from 'lodash'
import { upsertPreevyComment, Content } from './lib/github-comment'
import { parseUpDownFlagsDef } from './flags'
import { PluginConfig, loadGithubPullRequestCommentConfig } from './config'

const SCOPED_ENV_VAR = 'GITHUB_PR_COMMENT_ENABLED'

const upsertPrCommentHook = async ({ argv, pluginConfig, oclifConfig, log, envId, content }: {
  argv: string[]
  pluginConfig: PluginConfig
  oclifConfig: OclifConfig
  log: Logger
  envId: string
  content: Content
}) => {
  if (oclifConfig.scopedEnvVar(SCOPED_ENV_VAR) && !oclifConfig.scopedEnvVarTrue(SCOPED_ENV_VAR)) {
    log.debug(`Skipping due to env var ${oclifConfig.scopedEnvVarKey(SCOPED_ENV_VAR)}=${oclifConfig.scopedEnvVar(SCOPED_ENV_VAR)}`)
    return
  }

  const flags = parseUpDownFlagsDef(argv)

  if (flags['pr-comment-enabled'] === 'no') {
    log.debug('Skipping due to flag')
    return
  }

  const config = await loadGithubPullRequestCommentConfig({
    ciProvider: memoize(() => detectCiProvider()),
    flags,
    env: process.env,
    pluginConfig,
  }).catch(e => {
    log.warn(`failed to load github plugin config: ${e?.stack ?? e.toString()}`)
    return undefined
  })

  if (!config) {
    log.debug('no config, skipping envCreated/envDeleted hook')
    return
  }

  await upsertPreevyComment({
    octokit: new Octokit({ auth: config.token }),
  }, {
    ...config,
    envId,
    content,
  })
}

export const envCreated = ({ argv, pluginConfig, oclifConfig }: {
  argv: string[]
  pluginConfig: PluginConfig
  oclifConfig: OclifConfig
}): HookFunc<'envCreated'> => async ({ log }, { envId, urls }) => {
  await upsertPrCommentHook({ argv, pluginConfig, oclifConfig, log, envId, content: { urls } })
}

export const envDeleted = ({ argv, pluginConfig, oclifConfig }: {
  argv: string[]
  pluginConfig: PluginConfig
  oclifConfig: OclifConfig
}): HookFunc<'envDeleted'> => async ({ log }, { envId }) => {
  await upsertPrCommentHook({ argv, pluginConfig, oclifConfig, log, envId, content: 'deleted' })
}
