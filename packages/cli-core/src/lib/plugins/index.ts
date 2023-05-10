import { Command } from '@oclif/core'
import { FlagProps } from '@oclif/core/lib/interfaces/parser'
import { ComposeModel } from '../compose/model'

export { addFlags } from './add-flags'

type PluginContext = {
  model: ComposeModel
}

export type Flags = Record<string, FlagProps>
export type CommandsFlags = Record<string, Flags>

export type Plugin = {
  init: (context: PluginContext) => Promise<{
    addFlags?: CommandsFlags
  }>
}

export const addUserModel = (commands: Command.Loadable[], userModel: ComposeModel) => commands.map(command => {
  const { load } = command
  return Object.assign(command, {
    load: async () => Object.assign(await load.call(this), { userModel }),
  })
})
