import { Command, Flags, Interfaces } from '@oclif/core'
import { BaseCommand, ParsedFlags, envIdFlags } from '@preevy/cli-common'
import { CiProvider, detectCiProvider, findEnvId } from '@preevy/core'
import { PluginConfig, loadGithubConfig } from '../../config.js'
import { flagsDef } from '../../flags.js'


export type Flags<T extends typeof Command> = Interfaces.InferredFlags<typeof BaseGithubCommand['baseFlags'] & T['flags']>
export type Args<T extends typeof Command> = Interfaces.InferredArgs<T['args']>


abstract class BaseGithubCommand<T extends typeof Command> extends BaseCommand<T> {
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
    const envId = await findEnvId({
      userSpecifiedEnvId: this.flags.id,
      userSpecifiedProjectName: this.flags.project,
      userModel: await this.ensureUserModel(),
      log: this.logger,
    })
    return envId
  }

  #ciProviderLoaded: boolean = false
  #ciProvider: CiProvider | undefined
  protected get ciProvider() {
    if (!this.#ciProviderLoaded) {
      this.#ciProvider = detectCiProvider()
    }
    return this.#ciProvider
  }

  protected async loadGithubConfig(flags: ParsedFlags<typeof flagsDef>) {
    return await loadGithubConfig({
      ciProvider: () => this.ciProvider,
      env: process.env,
      flags,
      pluginConfig: this.pluginConfig,
    })
  }
}

export default BaseGithubCommand
