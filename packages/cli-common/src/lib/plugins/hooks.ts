import { HookFunc, HookName, hookNames } from '../hooks'
import { InitResults } from './model'

export const hooksFromPlugins = (
  initResults: InitResults[],
) => initResults.reduce(
  (acc, { hooks }) => {
    Object.entries(hooks || {})
      .forEach(([name, fn]) => { acc[name as HookName].push(fn as HookFunc<HookName>) })
    return acc
  },
  Object.fromEntries(hookNames.map(n => [n, [] as HookFunc<HookName>[]])),
)
