import { Command, Flags, Interfaces } from '@oclif/core'
import { BaseCommand, envIdFlags } from '@preevy/cli-common'
import { findEnvId } from '@preevy/core'
import { ParsedFlags, flagsDef } from '../../flags'
import { PluginConfig, githubConfigFromFlags, loadGithubConfig } from '../../config'

// eslint-disable-next-line no-use-before-define
export type Flags<T extends typeof Command> = Interfaces.InferredFlags<typeof BaseGithubPrCommand['baseFlags'] & T['flags']>
export type Args<T extends typeof Command> = Interfaces.InferredArgs<T['args']>

// eslint-disable-next-line no-use-before-define
abstract class BaseGithubPrCommand<T extends typeof Command> extends BaseCommand<T> {
  static baseFlags = {
    ...BaseCommand.baseFlags,
    ...envIdFlags,
    ...flagsDef,
  }

  protected flags!: Flags<T>
  protected args!: Args<T>

  protected get pluginConfig(): PluginConfig {
    return (this.constructor as unknown as { pluginConfig: PluginConfig }).pluginConfig
  }

  protected async getEnvId() {
    const { envId } = await findEnvId({
      userSpecifiedEnvId: this.flags.id,
      userSpecifiedProjectName: this.flags.project,
      userModel: await this.ensureUserModel(),
      log: this.logger.info,
    })
    return envId
  }

  protected async loadGithubConfig(flags: ParsedFlags<typeof flagsDef>) {
    return await loadGithubConfig(this.pluginConfig, await githubConfigFromFlags(flags), { log: this.logger })
  }
}

export default BaseGithubPrCommand
