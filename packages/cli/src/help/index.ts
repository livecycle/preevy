import { Help } from '@oclif/core'
import { BaseCommand } from '@preevy/cli-common'
import os from 'os'

export default class CustomHelpClass extends Help {
  protected async showRootHelp(): Promise<void> {
    await super.showRootHelp()
    this.log(this.formatFlag())
  }

  protected formatFlag():string {
 
    const flags = Object.entries(BaseCommand.baseFlags)
      .filter(([_name, flag]) => flag.helpGroup === 'GLOBAL')

      .map(([name, flag]) => ({ name, description: flag.summary ?? '' }))
    const body = this.renderList(flags.map(c => [
      `--${c.name}`,
      c.description,
    ]), {
      spacer: os.EOL,
      stripAnsi: this.opts.stripAnsi,
      indentation: 2,
    })

    return this.section('GLOBAL FLAGS', body)
  }
}
