import { Octokit } from 'octokit'
import { FlatTunnel } from '@preevy/core'
import { upsertPreevyComment } from '../../../lib/github-comment.js'
import BaseGithubPrCommand from './base.js'
import { commentTemplateFlagDef } from '../../../flags.js'

// eslint-disable-next-line no-use-before-define
class CommentGithubPr extends BaseGithubPrCommand<typeof CommentGithubPr> {
  static id = 'github:pr:comment'
  static description = 'Post a comment on a GitHub Pull Request describing the preevy environment'

  static flags = {
    ...BaseGithubPrCommand.baseFlags, // workaround: help not showing base flags due to command not cached
    ...commentTemplateFlagDef,
  }

  async run() {
    const urls = await this.config.runCommand('urls', [
      ...(this.flags.id === undefined ? [] : [`--id ${this.flags.id}`]),
      ...(this.flags.debug === undefined ? [] : ['--debug']),
      ...Array.isArray(this.flags.file) ? (this.flags.file.map(f => `--file ${f}`)) : [],
      ...(this.flags.project === undefined ? [] : [`--project ${this.flags.project}`]),
      '--json',
    ]) as FlatTunnel[]

    const { flags } = this
    const config = await this.loadGithubPullRequestCommentConfig(flags)

    await upsertPreevyComment({
      octokit: new Octokit({ auth: config.token }),
    }, {
      ...config,
      envId: await this.getEnvId(),
      content: { urls },
    })
  }
}

export default CommentGithubPr
