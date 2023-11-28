import { Command, Flags, Interfaces } from '@oclif/core'
import { Octokit } from 'octokit'
import { upsertPreevyComment } from '../../../lib/github-comment'
import BaseGithubPrCommand from './base'
import { commentTemplateFlagDef } from '../../../flags'

// eslint-disable-next-line no-use-before-define
export type Flags<T extends typeof Command> = Interfaces.InferredFlags<typeof UnCommentGithubPr['baseFlags'] & T['flags']>
export type Args<T extends typeof Command> = Interfaces.InferredArgs<T['args']>

// eslint-disable-next-line no-use-before-define
class UnCommentGithubPr extends BaseGithubPrCommand<typeof UnCommentGithubPr> {
  static id = 'github:pr:uncomment'
  static description = 'Update the Preevy comment on a GitHub Pull Request saying the preevy environment has been deleted'

  static flags = {
    ...BaseGithubPrCommand.baseFlags, // workaround: help not showing base flags due to command not cached
    ...commentTemplateFlagDef,
  }

  async run() {
    const { flags } = await this.parse(UnCommentGithubPr)
    const config = await this.loadGithubPullRequestCommentConfig(flags)

    await upsertPreevyComment({
      octokit: new Octokit({ auth: config.token }),
    }, {
      ...config,
      envId: await this.getEnvId(),
      content: 'deleted',
    })
  }
}

export default UnCommentGithubPr
