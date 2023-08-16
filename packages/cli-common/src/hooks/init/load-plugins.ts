import { Hook as OclifHook, Command, Flags } from '@oclif/core'
import { Parser } from '@oclif/core/lib/parser/parse'
import { Config, Topic } from '@oclif/core/lib/interfaces'
import { localComposeClient, ComposeModel, resolveComposeFiles, withSpinner, NoComposeFilesError } from '@preevy/core'
import { composeFlags } from '../../lib/flags'
import { addPluginFlags, loadPlugins, hooksFromPlugins, addPluginCommands } from '../../lib/plugins'

type InternalConfig = Config & {
  loadCommands: (plugin: { commands: Command.Loadable[]; topics: Topic[] }) => void
  loadTopics: (plugin: { topics: Topic[]; commands: Command.Loadable[] }) => void
}

const excludedCommandIds = ['init', 'version', /^profile:/, 'ls']

export const initHook: OclifHook<'init'> = async function hook({ config, id, argv }) {
  if (id && excludedCommandIds.some(excluded => (typeof excluded === 'string' ? excluded === id : excluded.test(id)))) {
    return
  }

  const { flags, raw } = await new Parser({
    flags: { ...composeFlags, json: Flags.boolean() },
    strict: false,
    args: {},
    context: undefined,
    argv,
  } as const).parse()
  const composeFiles = await resolveComposeFiles({
    userSpecifiedFiles: flags.file,
    systemFiles: flags['system-compose-file'],
  })

  const userModelOrError = composeFiles.length
    ? await withSpinner(
      // eslint false positive here on case-sensitive filesystems due to unknown type
      // eslint-disable-next-line @typescript-eslint/return-await
      async () => await localComposeClient({
        composeFiles,
        projectName: flags.project,
      }).getModelOrError(),
      {
        text: `Loading compose file${composeFiles.length > 1 ? 's' : ''}: ${composeFiles.join(', ')}`,
      },
    )
    : new NoComposeFilesError()

  const userModel = userModelOrError instanceof Error ? {} as ComposeModel : userModelOrError
  const preevyConfig = userModel['x-preevy'] ?? {}
  const loadedPlugins = await loadPlugins(preevyConfig, { userModel, oclifConfig: config, argv })
  const commands = addPluginFlags(addPluginCommands(config.commands, loadedPlugins), loadedPlugins)
  const topics = [...config.topics, ...loadedPlugins.flatMap(({ initResults }) => initResults.topics ?? [])];

  (config as InternalConfig).loadCommands({ commands, topics });
  (config as InternalConfig).loadTopics({ commands, topics })

  Object.assign(config, {
    initialUserModel: userModelOrError,
    preevyConfig,
    preevyHooks: hooksFromPlugins(loadedPlugins.map(p => p.initResults)),
  })

  if (id === 'help') {
    const restArgs = raw.filter(arg => arg.type === 'arg').map(arg => arg.input)
    argv.splice(0, argv.length, ...restArgs)
  }
}
