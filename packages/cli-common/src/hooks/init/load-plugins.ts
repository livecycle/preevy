import path from 'path'
import { Hook as OclifHook, Command, Flags } from '@oclif/core'
import { Parser } from '@oclif/core/lib/parser/parse.js'
import { BooleanFlag, Config, Topic } from '@oclif/core/lib/interfaces'
import { localComposeClient, ComposeModel, resolveComposeFiles, withSpinner, NoComposeFilesError } from '@preevy/core'
import { cloneDeep } from 'lodash-es'
import { composeFlags, pluginFlags } from '../../lib/common-flags/index.js'
import { addPluginFlags, loadPlugins, hooksFromPlugins, addPluginCommands } from '../../lib/plugins/index.js'

type InternalConfig = Config & {
  loadCommands: (plugin: { commands: Command.Loadable[]; topics: Topic[] }) => void
  loadTopics: (plugin: { topics: Topic[]; commands: Command.Loadable[] }) => void
}

const excludedCommandIds = ['init', 'version', /^profile:/, 'ls']

const flagDefs = cloneDeep({
  ...composeFlags,
  ...pluginFlags,
  json: Flags.boolean(),
}) as typeof composeFlags & typeof pluginFlags & { json: BooleanFlag<boolean> }

flagDefs['enable-plugin'].default = undefined

export const initHook: OclifHook<'init'> = async function hook(args) {
  const { config, id, argv } = args
  // workaround oclif bug when executing `preevy --flag1 --flag2` with no command
  if (id?.startsWith('-')) {
    await initHook.call(this, ({ ...args, id: undefined, argv: [id].concat(argv) }))
    return
  }

  if (id && excludedCommandIds.some(excluded => (typeof excluded === 'string' ? excluded === id : excluded.test(id)))) {
    return
  }

  const { flags, raw } = await new Parser({
    flags: flagDefs,
    strict: false,
    args: {},
    context: undefined,
    argv,
  } as const).parse()

  const { files: composeFiles, projectDirectory } = await resolveComposeFiles({
    userSpecifiedFiles: flags.file,
    userSpecifiedSystemFiles: flags['system-compose-file'],
    userSpecifiedProjectDirectory: flags['project-directory'],
    cwd: process.cwd(),
  })

  const userModelOrError = composeFiles.length
    ? await withSpinner(
      // eslint false positive here on case-sensitive filesystems due to unknown type
      // eslint-disable-next-line @typescript-eslint/return-await
      async () => await localComposeClient({
        composeFiles,
        projectName: flags.project,
        projectDirectory,
      }).getModelOrError(),
      {
        text: `Loading compose file${composeFiles.length > 1 ? 's' : ''}: ${composeFiles.join(', ')}`,
      },
    )
    : new NoComposeFilesError()

  const userModel = userModelOrError instanceof Error ? {} as ComposeModel : userModelOrError
  const preevyConfig = userModel['x-preevy'] ?? {}
  const loadedPlugins = await loadPlugins(
    config,
    flags,
    preevyConfig.plugins,
    { preevyConfig, userModel, oclifConfig: config, argv },
  )
  const commands = addPluginFlags(addPluginCommands(config.commands, loadedPlugins), loadedPlugins)
  const topics = [...config.topics, ...loadedPlugins.flatMap(({ initResults }) => initResults.topics ?? [])];

  (config as InternalConfig).loadCommands({ commands, topics });
  (config as InternalConfig).loadTopics({ commands, topics })

  Object.assign(config, {
    composeFiles: { files: composeFiles, projectDirectory },
    initialUserModel: userModelOrError,
    preevyConfig,
    preevyHooks: hooksFromPlugins(loadedPlugins.map(p => p.initResults)),
  })

  if (id === 'help') {
    const restArgs = raw.filter(arg => arg.type === 'arg').map(arg => arg.input).filter(Boolean)
    argv.splice(0, argv.length, ...restArgs)
  }
}
