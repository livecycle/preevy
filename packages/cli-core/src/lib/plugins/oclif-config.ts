import { Command, Config } from '@oclif/core'

export type HasLoadCommands = Omit<Config, 'loadCommands'> & {
  loadCommands: (plugin: { commands: Command.Loadable[]; topics: [] }) => void
}
