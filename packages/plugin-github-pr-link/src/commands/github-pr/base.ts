import { Command, Flags, Interfaces } from '@oclif/core'
import { BaseCommand, envIdFlags } from '@preevy/cli-common'
import { findAmbientEnvId } from '@preevy/core'
import { ParsedFlags, flagsDef } from '../../flags'
import { PluginConfig, loadGithubConfig } from '../../config'

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
    const log = this.logger
    const projectName = (await this.ensureUserModel()).name
    log.debug(`project: ${projectName}`)
    const envId = this.flags.id || await findAmbientEnvId(projectName)
    log.debug(`envId: ${envId}`)
    return envId
  }

  protected async loadGithubConfig() {
    const config = await loadGithubConfig(this.pluginConfig, this.flags as ParsedFlags)

    if (!config) {
      throw new Error('No GitHub config provided for plugin - specify env vars, flags or populate the compose file')
    }

    return config
  }
}

export default BaseGithubPrCommand
