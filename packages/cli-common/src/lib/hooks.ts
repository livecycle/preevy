import { ComposeModel, FlatTunnel } from '@preevy/core'
import { PluginContext } from './plugins/context.js'

export type Hooks = {
  filterUrls: {
    args: FlatTunnel[]
    return: FlatTunnel[]
  }
  envCreated: {
    args: {
      envId: string
      urls: FlatTunnel[]
    }
    return: void
  }
  envDeleted: {
    args: {
      envId: string
    }
    return: void
  }
  userModelFilter: {
    args: undefined
    return: ComposeModel
  }
}

export type HookName = keyof Hooks

export const hookNames: HookName[] = ['envCreated', 'envDeleted', 'userModelFilter']

export type HookFunc<Name extends HookName> = (context: PluginContext, args: Hooks[Name]['args']) => Promise<Hooks[Name]['return']>

export type HookFuncs = {
  [Name in HookName]: HookFunc<Name>
}

export type HooksListeners = {
  [P in HookName]: HookFunc<P>[]
}
