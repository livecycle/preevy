import { Hook as OclifHook, Command } from '@oclif/core'
import { Parser } from '@oclif/core/lib/parser/parse'
import { Config, Topic } from '@oclif/core/lib/interfaces'
import { localComposeClient, ComposeModel, resolveComposeFiles } from '@preevy/core'
import { composeFlags } from '../../lib/flags'
import { addPluginFlags, loadPlugins, hooksFromPlugins, addPluginCommands } from '../../lib/plugins'

type InternalConfig = Config & {
  loadCommands: (plugin: { commands: Command.Loadable[]; topics: Topic[] }) => void
}

export const initHook: OclifHook<'init'> = async function hook({ config, id: _id, argv }) {
  const { flags } = await new Parser({
    flags: { ...composeFlags },
    strict: false,
    args: {},
    context: undefined,
    argv,
  }).parse()

  const userModelOrError = await localComposeClient({
    composeFiles: resolveComposeFiles({ userSpecifiedFiles: flags.file, systemFiles: flags['system-compose-file'] }),
    projectName: flags.project,
  }).getModelOrError()

  const userModel = userModelOrError instanceof Error ? {} as ComposeModel : userModelOrError
  const preevyConfig = userModel['x-preevy'] ?? {}
  const loadedPlugins = await loadPlugins(preevyConfig, { userModel, oclifConfig: config, argv })
  const commands = addPluginFlags(addPluginCommands(config.commands, loadedPlugins), loadedPlugins);

  (config as InternalConfig).loadCommands({ commands, topics: config.topics })

  Object.assign(config, {
    initialUserModel: userModelOrError,
    preevyConfig,
    preevyHooks: hooksFromPlugins(loadedPlugins.map(p => p.initResults)),
  })
}
