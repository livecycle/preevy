import { Command } from '@oclif/core'
import { LoadedPlugin } from './load.js'

const pluginCommands = (loadedPlugins: LoadedPlugin[]) => loadedPlugins
  .flatMap(p => (p.initResults.commands ?? []).map(c => ({ command: c, pluginConfig: p.config })))
  .map(({ command, pluginConfig }) => Object.assign(command, {
    // add the pluginConfig property to the loaded command
    load: async (): Promise<Command.Class> => Object.assign(command, { pluginConfig }),
  }) as unknown as Command.Loadable)

export const addPluginCommands = (commands: Command.Loadable[], loadedPlugins: LoadedPlugin[]) => [
  ...pluginCommands(loadedPlugins),
  ...commands,
]
