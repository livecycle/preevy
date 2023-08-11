import { Help } from '@oclif/core'
import { BaseCommand } from '@preevy/cli-common'

export default class MyHelpClass extends Help {
  protected async showRootHelp(): Promise<void> {
    let rootTopics = this.sortedTopics
    let rootCommands = this.sortedCommands

    const state = this.config.pjson?.oclif?.state
    if (state) {
      this.log(
        state === 'deprecated'
          ? `${this.config.bin} is deprecated`
          : `${this.config.bin} is in ${state}.\n`,
      )
    }

    this.log(this.formatRoot())
    this.log('')

    if (!this.opts.all) {
      rootTopics = rootTopics.filter(t => !t.name.includes(':'))
      rootCommands = rootCommands.filter(c => !c.id.includes(':'))
    }

    if (rootTopics.length > 0) {
      this.log(this.formatTopics(rootTopics))
      this.log('')
    }

    if (rootCommands.length > 0) {
      rootCommands = rootCommands.filter(c => c.id)
      this.log(this.formatCommands(rootCommands))
      this.log('')
    }

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
            description: flag.summary !== undefined ? flag.summary : '',
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
