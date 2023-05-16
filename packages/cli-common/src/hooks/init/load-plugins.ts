import { Hook as OclifHook, Command } from '@oclif/core'
import { Parser } from '@oclif/core/lib/parser/parse'
import { Config, Topic } from '@oclif/core/lib/interfaces'
import { asyncMap, asyncToArray } from 'iter-tools-es'
import { ComposeModel, localComposeClient } from '@preevy/core'
import { HookFunc, HookName, HooksListeners } from '../../lib/hooks'
import { InitResults, PluginModule } from '../../lib/plugins'
import { composeFlags } from '../../lib/flags'
import { addFlags } from '../../lib/plugin-flags'

declare module '@oclif/core/lib/config/config' {
  export interface Config {
    initialUserModel: ComposeModel | Error
    preevyHooks: HooksListeners
  }
}

declare module '@oclif/core/lib/interfaces' {
  export interface Config {
    initialUserModel: ComposeModel | Error
    preevyHooks: HooksListeners
  }
}

const hooksFromPlugins = (
  initResults: InitResults[],
) => initResults.reduce(
  (acc, { hooks }) => {
    Object.entries(hooks || {})
      .forEach(([name, fn]) => { (acc[name as HookName] ||= []).push(fn as HookFunc<HookName>) })
    return acc
  },
  {} as Record<HookName, HookFunc<HookName>[]>,
)

export const initHook: OclifHook<'init'> = async function hook({ config, id: _id, argv }) {
  const { flags } = await new Parser({
    flags: composeFlags,
    strict: false,
    args: {},
    context: undefined,
    argv,
  }).parse()

  const userModel = await localComposeClient({
    composeFiles: flags.file,
    projectName: flags.project,
  }).getModelOrError()

  const preevyModel = userModel instanceof Error ? {} : userModel['x-preevy']
  const pluginDefinitions = (preevyModel?.plugins ?? []).filter(p => !p.disabled)

  const plugins = await asyncToArray(asyncMap(
    async p => ({ plugin: (await import(p.module) as PluginModule).preevyPlugin, config: p }),
    pluginDefinitions,
  ))

  const initResultsWithConfigs = await Promise.all(
    plugins.map(async p => ({
      initResults: await p.plugin.init({ userModel, oclifConfig: config, pluginConfig: p.config, argv }),
      config: p.config,
    })),
  )

  const pluginCommands = initResultsWithConfigs
    .flatMap(p => (p.initResults.commands ?? []).map(c => ({ command: c, pluginConfig: p.config })))
    .map(({ command, pluginConfig }) => Object.assign(command, {
      load: async (): Promise<Command.Class> => Object.assign(command, { pluginConfig }),
    }) as unknown as Command.Loadable)

  const commands = [...config.commands, ...pluginCommands]

  type InternalConfig = Config & {
    loadCommands: (plugin: { commands: Command.Loadable[]; topics: Topic[] }) => void
  }

  const flagsToAdd = initResultsWithConfigs.flatMap(p => (p.initResults.flags ?? []));

  (config as InternalConfig).loadCommands({
    commands: addFlags(commands, ...flagsToAdd),
    topics: config.topics,
  })

  Object.assign(config, {
    initialUserModel: userModel,
    preevyHooks: hooksFromPlugins(initResultsWithConfigs.map(p => p.initResults)),
  })
}
