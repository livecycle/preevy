import { Command, Flags, Interfaces } from '@oclif/core'
import { Octokit } from 'octokit'
import { FlatTunnel } from '@preevy/core'
import { upsertPreevyComment } from '../../lib/github-comment'
import BaseGithubPrCommand from './base'

// eslint-disable-next-line no-use-before-define
export type Flags<T extends typeof Command> = Interfaces.InferredFlags<typeof LinkGithubPr['baseFlags'] & T['flags']>
export type Args<T extends typeof Command> = Interfaces.InferredArgs<T['args']>

// eslint-disable-next-line no-use-before-define
class LinkGithubPr extends BaseGithubPrCommand<typeof LinkGithubPr> {
  static id = 'github-pr:link'
  static description = 'Link a GitHub Pull Request to an existing environment'

  static flags = {}

  async run() {
    const urls = await this.config.runCommand('urls', [
      ...(this.flags.id === undefined ? [] : [`--id ${this.flags.id}`]),
      ...(this.flags.debug === undefined ? [] : ['--debug']),
      ...(this.flags.file.map(f => `--file ${f}`)),
      ...(this.flags.project === undefined ? [] : [`--project ${this.flags.project}`]),
      '--json',
    ]) as FlatTunnel[]

    const { flags } = await this.parse(LinkGithubPr)
    const config = await this.loadGithubConfig(flags)

    await upsertPreevyComment({
      octokit: new Octokit({ auth: config.token }),
    }, {
      ...config,
      envId: await this.getEnvId(),
      content: { urls },
    })
  }
}

export default LinkGithubPr
