import { CommandHelp as BaseCommandHelp, Help as OclifHelp } from '@oclif/core'
import { HelpOptions, Config, Topic } from '@oclif/core/lib/interfaces'
import { BaseCommand, text } from '@preevy/cli-common'

class GlobalFlagsHelp extends BaseCommandHelp {
  constructor(config: Config, opts: HelpOptions) {
    super(BaseCommand, config, opts)
  }

  globalFlags() {
    const flags = Object.entries(BaseCommand.baseFlags).map(([name, value]) => ({ ...value, name }))
    return this.flags(flags)
  }
}

class CommandHelp extends BaseCommandHelp {
  constructor(...args: ConstructorParameters<typeof BaseCommandHelp>) {
    super(...args)
  }
}

export default class Help extends OclifHelp {
  constructor(...args: ConstructorParameters<typeof OclifHelp>) {
    super(...args)
    this.CommandHelpClass = CommandHelp
  }

  protected formatGlobalFlags(): string {
    return this.section('GLOBAL FLAGS', new GlobalFlagsHelp(this.config, this.opts).globalFlags())
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
