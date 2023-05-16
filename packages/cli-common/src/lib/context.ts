import { Config as OclifConfig } from '@oclif/core/lib/interfaces'
import { ComposeModel, Logger } from '@preevy/core'

export type PluginContext = {
  userModel: ComposeModel
  log: Logger
}

export type PluginInitContext<PluginConfig extends {} = {}> = {
  userModel: ComposeModel
  oclifConfig: OclifConfig
  pluginConfig: PluginConfig
  argv: string[]
}
