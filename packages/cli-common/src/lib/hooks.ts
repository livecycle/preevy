import { ComposeModel, FlatTunnel } from '@preevy/core'
import { PluginContext } from './plugins/context'

export type Hooks = {
  envCreated: {
    args: {
      envId: string
      urls: FlatTunnel[]
    }
    return: { urls: FlatTunnel[] }
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
