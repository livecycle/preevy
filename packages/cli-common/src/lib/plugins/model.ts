import { FlagProps } from '@oclif/core/lib/interfaces/parser.js'
import { Topic } from '@oclif/core/lib/interfaces/index.js'
import { Command } from '@oclif/core'
import { ComposeFiles, ComposeModel, config as coreConfig } from '@preevy/core'
import { PluginInitContext } from './context.js'
import { HookFuncs, HooksListeners } from '../hooks.js'
import PreevyConfig = coreConfig.PreevyConfig

export type Flags = Record<string, FlagProps>
export type CommandFlags = { command: string; flags: Flags }
export type InitResults = {
  flags?: CommandFlags[]
  commands?: Command.Class[]
  topics?: Topic[]
  hooks?: Partial<HookFuncs>
}

export type Plugin<PluginConfig extends {} = {}> = {
  init: (context: PluginInitContext<PluginConfig>) => Promise<InitResults>
}

export type PluginModule = {
  preevyPlugin: Plugin
}

declare module '@oclif/core/lib/config/config.js' {
  export interface Config {
    composeFiles: ComposeFiles
    initialUserModel: ComposeModel | Error
    preevyHooks: HooksListeners
    preevyConfig: PreevyConfig
  }
}

declare module '@oclif/core/lib/interfaces/index.js' {
  export interface Config {
    initialUserModel: ComposeModel | Error
    preevyHooks: HooksListeners
    preevyConfig: PreevyConfig
  }
}
