import { HookFunc } from '@preevy/cli-common'
import { Octokit } from 'octokit'
import { Config as OclifConfig } from '@oclif/core/lib/interfaces'
import { upsertPreevyComment } from '../lib/github-comment'
import { parseFlags, prefixedFlagsDef } from '../flags'
import { PluginConfig, loadGithubConfigOrSkip } from '../config'

export const envDeleted = ({ argv, pluginConfig, oclifConfig }: {
  argv: string[]
  pluginConfig: PluginConfig
  oclifConfig: OclifConfig
}): HookFunc<'envDeleted'> => async ({ log }, { envId }) => {
  const flags = await parseFlags(prefixedFlagsDef, argv)
  const config = await loadGithubConfigOrSkip(oclifConfig, pluginConfig, flags, log)
  if (!config) {
    return
  }

  const { repo, pullRequest, token } = config

  await upsertPreevyComment({
    octokit: new Octokit({ auth: token }),
  }, {
    repo,
    pullRequest,
    envId,
    content: 'deleted',
  })
}
