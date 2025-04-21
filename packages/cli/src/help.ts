import { CommandHelp as BaseCommandHelp, Command, Help as OclifHelp } from '@oclif/core'
import { HelpOptions, Config, Topic } from '@oclif/core/lib/interfaces/index.js'
import { BaseCommand, text } from '@preevy/cli-common'

class GlobalFlagsHelp extends BaseCommandHelp {
  constructor(command: Command.Loadable, config: Config, opts: HelpOptions) {
    super(command, config, opts)
  }

  globalFlags() {
    const flags = Object.entries(BaseCommand.baseFlags).map(([name, value]) => ({ ...value, name }))
    return this.flags(flags)
  }
}

export default class Help extends OclifHelp {
  protected formatGlobalFlags(): string {
    return this.section('GLOBAL FLAGS', new GlobalFlagsHelp(this.config.commands[0], this.config, this.opts).globalFlags())
  }

  override async showRootHelp(): Promise<void> {
    if (!this.opts.stripAnsi) {
      this.log(text.logo)
    }
    await super.showRootHelp()
    this.log(this.formatGlobalFlags())
    this.log('')
  }

  override async showTopicHelp(topic: Topic): Promise<void> {
    await super.showTopicHelp(topic)
    this.log(this.formatGlobalFlags())
    this.log('')
  }
}
