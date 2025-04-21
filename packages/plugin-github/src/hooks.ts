import { HookFunc, HookName } from '@preevy/cli-common'
import { Octokit } from 'octokit'
import { Config as OclifConfig } from '@oclif/core/lib/interfaces/index.js'
import { Logger, detectCiProvider } from '@preevy/core'
import { mapValues, memoize } from 'lodash-es'
import { upsertPreevyComment, Content } from './lib/github-comment.js'
import { parseUpDownFlagsDef } from './flags.js'
import { PluginConfig, loadGithubPullRequestCommentConfig } from './config.js'

const COMMENT_ENABLED_ENV_KEY = 'GITHUB_PR_COMMENT_ENABLED'

const upsertPrCommentHook = async ({ argv, pluginConfig, oclifConfig, log, envId, content }: {
  argv: string[]
  pluginConfig: PluginConfig
  oclifConfig: OclifConfig
  log: Logger
  envId: string
  content: Content
}) => {
  if (oclifConfig.scopedEnvVar(COMMENT_ENABLED_ENV_KEY) && !oclifConfig.scopedEnvVarTrue(COMMENT_ENABLED_ENV_KEY)) {
    log.debug(`Skipping due to env var ${oclifConfig.scopedEnvVarKey(COMMENT_ENABLED_ENV_KEY)}=${oclifConfig.scopedEnvVar(COMMENT_ENABLED_ENV_KEY)}`)
    return
  }

  const flags = await parseUpDownFlagsDef(argv)

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

type HookFactory<T extends HookName> = ({ argv, pluginConfig, oclifConfig }: {
  argv: string[]
  pluginConfig: PluginConfig
  oclifConfig: OclifConfig
}) => Promise<HookFunc<T>>

export const envCreated: HookFactory<'envCreated'> = async (
  { argv, pluginConfig, oclifConfig },
) => async ({ log }, { envId, urls }) => {
  await upsertPrCommentHook({ argv, pluginConfig, oclifConfig, log, envId, content: { urls } })
}

export const envDeleted: HookFactory<'envDeleted'> = async (
  { argv, pluginConfig, oclifConfig },
) => async ({ log }, { envId }) => {
  await upsertPrCommentHook({ argv, pluginConfig, oclifConfig, log, envId, content: 'deleted' })
}

export const userModelFilter: HookFactory<'userModelFilter'> = async ({ argv }) => {
  const { 'add-build-cache': addBuildCache } = await parseUpDownFlagsDef(argv)
  if (!addBuildCache) {
    return async ({ userModel }) => userModel
  }

  return async ({ log, userModel }) => {
    log.debug('Adding GHA build cache to user model')

    return {
      ...userModel,
      services: {
        ...mapValues(userModel.services ?? {}, (({ build, ...rest }, serviceName) => {
          if (!build) {
            return rest
          }

          const scope = [userModel.name, serviceName].join('/')

          return ({
            ...rest,
            build: {
              ...build,
              cache_from: (build.cache_from ?? []).concat(`type=gha,scope=${scope}`),
              cache_to: (build.cache_to ?? []).concat(`type=gha,scope=${scope},mode=max`),
            },
          })
        })),
      },
    }
  }
}
