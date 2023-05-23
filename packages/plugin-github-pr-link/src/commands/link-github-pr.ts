import { Command, Flags, Interfaces } from '@oclif/core'
import { BaseCommand, envIdFlags } from '@preevy/cli-common'
import { Octokit } from 'octokit'
import { findAmbientEnvId, FlatTunnel } from '@preevy/core'
import { flagsDef, ParsedFlags } from '../flags'
import { loadGithubConfig, PluginConfig } from '../config'
import { upsertPreevyComment } from '../lib/github-comment'

// eslint-disable-next-line no-use-before-define
export type Flags<T extends typeof Command> = Interfaces.InferredFlags<typeof LinkGithubPr['baseFlags'] & T['flags']>
export type Args<T extends typeof Command> = Interfaces.InferredArgs<T['args']>

// eslint-disable-next-line no-use-before-define
class LinkGithubPr extends BaseCommand<typeof LinkGithubPr> {
  static id = 'link-github-pr'
  static description = 'Link a GitHub Pull Request to an existing environment'

  static flags = {
    ...envIdFlags,
    ...flagsDef,
  }

  protected get pluginConfig(): PluginConfig {
    return (this.constructor as unknown as { pluginConfig: PluginConfig }).pluginConfig
  }

  async run() {
    const config = await loadGithubConfig(this.pluginConfig, this.flags as ParsedFlags)

    if (!config) {
      throw new Error('No GitHub config provided for plugin - specify env vars, flags or populate the compose file')
    }

    const log = this.logger
    const projectName = (await this.ensureUserModel()).name
    log.debug(`project: ${projectName}`)
    const envId = this.flags.id || await findAmbientEnvId(projectName)
    log.debug(`envId: ${envId}`)

    const urls = await this.config.runCommand('urls', [
      ...(this.flags.id === undefined ? [] : [`--id ${this.flags.id}`]),
      ...(this.flags.debug === undefined ? [] : ['--debug']),
      ...(this.flags.file.map(f => `--file ${f}`)),
      ...(this.flags.project === undefined ? [] : [`--project ${this.flags.project}`]),
      '--json',
    ]) as FlatTunnel[]

    const { repo, pullRequest, token } = config

    await upsertPreevyComment({
      octokit: new Octokit({ auth: token }),
    }, {
      repo,
      pullRequest,
      envId,
      status: { urls },
    })
  }
}

export default LinkGithubPr
