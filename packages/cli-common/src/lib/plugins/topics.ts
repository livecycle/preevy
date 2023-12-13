import { Topic } from '@oclif/core/lib/interfaces'
import { LoadedPlugin } from './load.js'

export const addPluginCommands = (topics: Topic[], loadedPlugins: LoadedPlugin[]) => [
  ...topics,
  ...loadedPlugins.flatMap(({ initResults }) => initResults.topics ?? []),
]
