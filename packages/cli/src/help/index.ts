import { Help } from '@oclif/core'
import { BaseCommand } from '@preevy/cli-common'

export default class MyHelpClass extends Help {
  protected async showRootHelp(): Promise<void> {
    await super.showRootHelp()
    this.log(this.formatFlag())
  }

  protected formatFlag():string {
    type Flag = {
      name: string
      description: string
    };

    const flags: Flag[] = []

    for (const flagName of Object.keys(BaseCommand.baseFlags)) {
      if (BaseCommand.baseFlags.hasOwnProperty.call(BaseCommand.baseFlags, flagName)) {
        const flagKey = flagName as keyof typeof BaseCommand.baseFlags
        const flag = BaseCommand.baseFlags[flagKey]
        if (flag.helpGroup === 'GLOBAL') {
          const flagHelp: Flag = {
            name: flagName,
            description: flag.summary ?? '',
          }
          flags.push(flagHelp)
        }
      }
    }
    const body = this.renderList(flags.map(c => [
      `--${c.name}`,
      c.description,
    ]), {
      spacer: '\n',
      stripAnsi: this.opts.stripAnsi,
      indentation: 2,
    })

    return this.section('GLOBAL FLAGS', body)
  }
}
