import { FlagProps } from '@oclif/core/lib/interfaces/parser'
import { Command } from '@oclif/core'
import { ComposeModel, config as coreConfig } from '@preevy/core'
import { PluginInitContext } from './context'
import { HookFuncs, HooksListeners } from '../hooks'
import PreevyConfig = coreConfig.PreevyConfig

export type Flags = Record<string, FlagProps>
export type CommandFlags = { command: string; flags: Flags }
export type InitResults = {
  flags?: CommandFlags[]
  commands?: Command.Class[]
  hooks?: Partial<HookFuncs>
}

export type Plugin<PluginConfig extends {} = {}> = {
  init: (context: PluginInitContext<PluginConfig>) => Promise<InitResults>
}

export type PluginModule = {
  preevyPlugin: Plugin
}

declare module '@oclif/core/lib/config/config' {
  export interface Config {
    initialUserModel: ComposeModel | Error
    preevyHooks: HooksListeners
    preevyConfig: PreevyConfig
  }
}

declare module '@oclif/core/lib/interfaces' {
  export interface Config {
    initialUserModel: ComposeModel | Error
    preevyHooks: HooksListeners
    preevyConfig: PreevyConfig
  }
}
