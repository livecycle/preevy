import { HookFunc, HookName, hookNames } from '../hooks.js'
import { InitResults } from './model.js'

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
