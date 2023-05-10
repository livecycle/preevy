import {
  Hook,
  Command,
} from '@oclif/core'
import { Parser } from '@oclif/core/lib/parser/parse'
import { Config } from '@oclif/core/lib/interfaces'
import { asyncMap, asyncToArray } from 'iter-tools-es'
import { composeFlags } from '@preevy/cli-core/src/lib/compose/flags'
import { localComposeClient } from '@preevy/cli-core/src/lib/compose/client'
import { CommandsFlags, Plugin, addFlags, addUserModel } from '@preevy/cli-core/src/lib/plugins'

type InternalConfig = Config & {
  loadCommands: (plugin: { commands: Command.Loadable[]; topics: [] }) => void
}

// class TestCommand extends Command {
//   static id = 'testcommand'

//   static summary = 'Test Command'

//   async run() {
//     this.log('Test command output')
//   }

//   static async load(): Promise<Command.Class> {
//     return this
//   }
// }

// const commandLoader: Command.Loadable = {
//   strict: false,
//   aliases: [],
//   args: {},
//   flags: {},
//   hidden: false,
//   id: TestCommand.id,
//   async load(): Promise<Command.Class> {
//     return TestCommand
//   },
//   pluginType: 'user',
// }

const hook: Hook<'init'> = async function hook({ config, id, argv }) {
  console.log('hook', { config, id, argv })
  const { flags } = await new Parser({
    flags: composeFlags,
    strict: false,
    args: {},
    context: undefined,
    argv,
  }).parse()
  console.log('flags', flags)

  const userModel = await localComposeClient(flags.file, flags.project).getModelOrUndefined()

  if (!userModel) {
    return
  }

  const preevyModel = userModel['x-preevy'] || {}
  const modelPlugins = (preevyModel.plugins || []).filter(p => !p.disabled)

  const plugins = await asyncToArray(asyncMap(p => import(p.module), modelPlugins)) as Plugin[]
  const initResults = await Promise.all(plugins.map(p => p.init({ model: userModel })))
  const flagsToAddFromHooks = initResults.map(r => r.addFlags).filter(Boolean) as CommandsFlags[]

  (this.config as InternalConfig).loadCommands({
    commands: addUserModel(addFlags(config.commands, ...flagsToAddFromHooks), userModel),
    topics: [],
  })
}

const wrappedHook: Hook<'init'> = async function wrappedHook(...args) {
  try {
    await hook.call(this, ...args)
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('init hook error', e)
    process.exit(1)
  }
}

export default wrappedHook
