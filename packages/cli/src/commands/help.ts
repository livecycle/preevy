// Taken from: https://github.com/oclif/plugin-help/blob/main/src/commands/help.ts (MIT License)
// The only change is that we're using our own Help class, which displays global files on topics.
import { Args, Command, Flags } from '@oclif/core'
import Help from '../help'

export default class HelpCommand extends Command {
  static args = {
    commands: Args.string({ description: 'Command to show help for.', required: false }),
  }

  static description = 'Display help for <%= config.bin %>.'

  static flags = {
    'nested-commands': Flags.boolean({
      char: 'n',
      description: 'Include all nested commands in the output.',
    }),
  }

  static strict = false

  async run(): Promise<void> {
    const { argv, flags } = await this.parse(HelpCommand)
    const help = new Help(this.config, { all: flags['nested-commands'] })
    await help.showHelp(argv as string[])
  }
}
