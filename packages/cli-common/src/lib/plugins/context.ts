import { Config as OclifConfig } from '@oclif/core/lib/interfaces/index.js'
import { ComposeModel, Logger, config } from '@preevy/core'

import PreevyConfig = config.PreevyConfig

export type PluginContext = {
  userModel: ComposeModel
  log: Logger
}

export type PluginInitContext<PluginConfig extends {} = {}> = {
  userModel: ComposeModel
  oclifConfig: OclifConfig
  pluginConfig: PluginConfig
  preevyConfig: PreevyConfig
  argv: string[]
}
