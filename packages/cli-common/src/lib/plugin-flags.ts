import { Command } from '@oclif/core'
import { groupBy } from 'lodash'
import { CommandFlags } from './plugins'

export const addFlags = (
  commands: Command.Loadable[],
  ...commandFlags: CommandFlags[]
) => {
  const grouped = groupBy(commandFlags, c => c.command)
  return commands.map(c => {
    const flags = grouped[c.id]?.map(f => f.flags)
    if (!flags?.length) {
      return c
    }

    Object.assign(c.flags, ...flags)

    const { load } = c
    return Object.assign(c, {
      load: async () => {
        const r = await load.call(this)
        Object.assign(r.flags, ...flags)
        return r
      },
    })
  })
}
