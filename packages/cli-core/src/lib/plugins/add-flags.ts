import { FlagProps } from '@oclif/core/lib/interfaces/parser'
import { Command } from '@oclif/core'
import { groupBy, mapValues } from 'lodash'

type Flags = Record<string, FlagProps>
type CommandToFlags = Record<string, Flags>

const groupFlags = (commandToFlags: CommandToFlags[]) => {
  const grouped = mapValues(
    groupBy(commandToFlags.flatMap(c => Object.entries(c)), ([id]) => id),
    (f: [string, Flags][]) => f.flatMap<Flags>(v => v[1]),
  )
  return mapValues(grouped, flagList => flagList.reduce((res, flags) => Object.assign(res, flags), {}))
}

export const addFlags = (
  commands: Command.Loadable[],
  ...commandToFlags: CommandToFlags[]
) => {
  const grouped = groupFlags(commandToFlags)
  return commands.map(c => {
    const flags = grouped[c.id]
    if (!flags) {
      return c
    }

    Object.assign(c.flags, flags)

    const { load } = c
    return Object.assign(c, {
      load: async () => {
        const r = await load.call(this)
        Object.assign(r.flags, flags)
        return r
      },
    })
  })
}
