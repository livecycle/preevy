import { Command } from '@oclif/core'
import { FlagProps } from '@oclif/core/lib/interfaces/parser'
import { Config } from '@oclif/core/lib/interfaces'
import { ComposeModel } from '../compose/model'
import { FlatTunnel } from '../tunneling'

export { addFlags } from './add-flags'

type PluginContext = {
  userModel: ComposeModel
  config: Config
}

export type Flags = Record<string, FlagProps>
export type CommandsFlags = Record<string, Flags>

export type Hooks = {
  envCreated: {
    args: {
      envId: string
      urls: FlatTunnel[]
    }
    return: void
  }
  userModelFilter: {
    args: undefined
    return: ComposeModel
  }
}

export type HookName = keyof Hooks

export type HookFunc<Name extends HookName> = (context: PluginContext, args: Hooks[Name]['args']) => Promise<Hooks[Name]['return']>

export type HooksListeners = {
  [P in HookName]: HookFunc<P>[]
}

export type Plugin = {
  init: (context: PluginContext) => Promise<{
    addFlags?: CommandsFlags
    hooks?: {
      [Name in HookName]: HookFunc<Name>
    }
  }>
}

export const addCommandProps = <T extends {}>(commands: Command.Loadable[], props: T) => commands.map(command => {
  const { load } = command
  return Object.assign(command, {
    load: async () => Object.assign(await load.call(this), props),
  })
})
