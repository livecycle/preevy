import { HookFunc } from '@preevy/cli-common'
import { Octokit } from 'octokit'
import { Config as OclifConfig } from '@oclif/core/lib/interfaces'
import { Logger } from '@preevy/core'
import { upsertPreevyComment, Content } from './lib/github-comment'
import { parseFlags, prefixedFlagsDef } from './flags'
import { PluginConfig, loadGithubConfigOrSkip } from './config'

const hook = async ({ argv, pluginConfig, oclifConfig, log, envId, content }: {
  argv: string[]
  pluginConfig: PluginConfig
  oclifConfig: OclifConfig
  log: Logger
  envId: string
  content: Content
}) => {
  const flags = await parseFlags(prefixedFlagsDef, argv)
  const config = await loadGithubConfigOrSkip(oclifConfig, pluginConfig, flags, log).catch(e => {
    log.debug(e)
  })

  if (!config) {
    log.debug('no config, skipping envCreated hook')
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
  await hook({ argv, pluginConfig, oclifConfig, log, envId, content: { urls } })
  return { urls }
}

export const envDeleted = ({ argv, pluginConfig, oclifConfig }: {
  argv: string[]
  pluginConfig: PluginConfig
  oclifConfig: OclifConfig
}): HookFunc<'envDeleted'> => async ({ log }, { envId }) => {
  await hook({ argv, pluginConfig, oclifConfig, log, envId, content: 'deleted' })
}
