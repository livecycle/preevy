import { HookFunc } from '@preevy/cli-common'
import { Octokit } from 'octokit'
import { Config as OclifConfig } from '@oclif/core/lib/interfaces'
import { upsertPreevyComment } from '../lib/github-comment'
import { PluginConfig, loadGithubConfigOrSkip } from '../config'
import { parseFlags } from '../flags'

export const envCreated = ({ argv, pluginConfig, oclifConfig }: {
  argv: string[]
  pluginConfig: PluginConfig
  oclifConfig: OclifConfig
}): HookFunc<'envCreated'> => async ({ log }, { envId, urls }) => {
  const flags = await parseFlags(argv)

  log.debug('flags', flags)
  const config = await loadGithubConfigOrSkip(oclifConfig, pluginConfig, flags, log)
  if (!config) {
    log.debug('no config, skipping envCreated hook')
    return { urls }
  }

  const { repo, pullRequest, token } = config

  await upsertPreevyComment({
    octokit: new Octokit({ auth: token }),
  }, {
    repo,
    pullRequest,
    envId,
    status: { urls },
  })

  return { urls }
}
