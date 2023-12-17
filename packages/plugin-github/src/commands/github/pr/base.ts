import { Command, Flags, Interfaces } from '@oclif/core'
import { ParsedFlags } from '@preevy/cli-common'
import { commentTemplateFlagDef, flagsDef, pullRequestFlagsDef } from '../../../flags.js'
import BaseGithubCommand from '../base.js'
import { GithubConfig, loadGithubPullRequestCommentConfig, loadGithubPullRequestConfig } from '../../../config.js'

const ensureConfig = <T extends GithubConfig>(config: T | undefined) => {
  if (!config) {
    throw new Error('Missing GitHub config')
  }
  return config
}

// eslint-disable-next-line no-use-before-define
export type Flags<T extends typeof Command> = Interfaces.InferredFlags<typeof BaseGithubPrCommand['baseFlags'] & T['flags']>
export type Args<T extends typeof Command> = Interfaces.InferredArgs<T['args']>

// eslint-disable-next-line no-use-before-define
abstract class BaseGithubPrCommand<T extends typeof Command> extends BaseGithubCommand<T> {
  static description = 'GitHub Pull Requests integration'

  static baseFlags = {
    ...BaseGithubCommand.baseFlags,
    ...pullRequestFlagsDef,
  }

  protected flags!: Flags<T>
  protected args!: Args<T>

  protected async loadGithubPullRequestConfig(flags: ParsedFlags<typeof flagsDef & typeof pullRequestFlagsDef>) {
    return ensureConfig(await loadGithubPullRequestConfig(
      {
        ciProvider: () => this.ciProvider,
        env: process.env,
        flags,
        pluginConfig: this.pluginConfig,
      },
      await this.loadGithubConfig(flags),
    ))
  }

  protected async loadGithubPullRequestCommentConfig(
    flags: ParsedFlags<typeof flagsDef & typeof pullRequestFlagsDef & typeof commentTemplateFlagDef>
  ) {
    return ensureConfig(await loadGithubPullRequestCommentConfig(
      {
        ciProvider: () => this.ciProvider,
        env: process.env,
        flags,
        pluginConfig: this.pluginConfig,
      },
      await this.loadGithubPullRequestConfig(flags),
    ))
  }
}

export default BaseGithubPrCommand
