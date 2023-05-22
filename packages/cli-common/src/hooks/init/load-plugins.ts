import { Hook as OclifHook, Command } from '@oclif/core'
import { Parser } from '@oclif/core/lib/parser/parse'
import { Config, Topic } from '@oclif/core/lib/interfaces'
import { localComposeClient, config as coreConfig, ComposeModel } from '@preevy/core'
import loadConfig = coreConfig.loadConfig
import { composeFlags, configFlags } from '../../lib/flags'
import { addPluginFlags, loadPlugins, hooksFromPlugins, addPluginCommands } from '../../lib/plugins'

type InternalConfig = Config & {
  loadCommands: (plugin: { commands: Command.Loadable[]; topics: Topic[] }) => void
}

export const initHook: OclifHook<'init'> = async function hook({ config, id: _id, argv }) {
  const { flags } = await new Parser({
    flags: { ...composeFlags, ...configFlags },
    strict: false,
    args: {},
    context: undefined,
    argv,
  }).parse()

  const userModelOrError = await localComposeClient({
    composeFiles: flags.file,
    projectName: flags.project,
  }).getModelOrError()

  const userModel = userModelOrError instanceof Error ? {} as ComposeModel : userModelOrError
  const preevyConfig = await loadConfig(flags.config || [], userModel)
  const loadedPlugins = await loadPlugins(preevyConfig, { userModel, oclifConfig: config, argv })
  const commands = addPluginFlags(addPluginCommands(config.commands, loadedPlugins), loadedPlugins);

  (config as InternalConfig).loadCommands({ commands, topics: config.topics })

  Object.assign(config, {
    initialUserModel: userModelOrError,
    preevyConfig,
    preevyHooks: hooksFromPlugins(loadedPlugins.map(p => p.initResults)),
  })
}
