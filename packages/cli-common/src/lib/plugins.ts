import { FlagProps } from '@oclif/core/lib/interfaces/parser'
import { Command } from '@oclif/core'
import { PluginInitContext } from './context'
import { HookFuncs } from './hooks'

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
