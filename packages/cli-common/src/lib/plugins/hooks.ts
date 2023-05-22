import { HookFunc, HookName } from '../hooks'
import { InitResults } from './model'

export const hooksFromPlugins = (
  initResults: InitResults[],
) => initResults.reduce(
  (acc, { hooks }) => {
    Object.entries(hooks || {})
      .forEach(([name, fn]) => { (acc[name as HookName] ||= []).push(fn as HookFunc<HookName>) })
    return acc
  },
  {} as Record<HookName, HookFunc<HookName>[]>,
)
