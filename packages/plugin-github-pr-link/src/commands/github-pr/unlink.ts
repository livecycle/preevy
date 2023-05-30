import { Command, Flags, Interfaces } from '@oclif/core'
import { Octokit } from 'octokit'
import { upsertPreevyComment } from '../../lib/github-comment'
import BaseGithubPrCommand from './base'

// eslint-disable-next-line no-use-before-define
export type Flags<T extends typeof Command> = Interfaces.InferredFlags<typeof UnLinkGithubPr['baseFlags'] & T['flags']>
export type Args<T extends typeof Command> = Interfaces.InferredArgs<T['args']>

// eslint-disable-next-line no-use-before-define
class UnLinkGithubPr extends BaseGithubPrCommand<typeof UnLinkGithubPr> {
  static id = 'github-pr:unlink'
  static description = 'Unlink a GitHub Pull Request from an environment'

  static flags = {}

  async run() {
    const { flags } = await this.parse(UnLinkGithubPr)
    const config = await this.loadGithubConfig(flags)

    await upsertPreevyComment({
      octokit: new Octokit({ auth: config.token }),
    }, {
      ...config,
      envId: await this.getEnvId(),
      content: 'deleted',
    })
  }
}

export default UnLinkGithubPr
