import chalk from 'chalk'
import { Command } from '@oclif/core'
import { HelpFormatter } from '@oclif/core/lib/help/formatter'
import { BaseCommand } from '@preevy/cli-common'

const {
  underline,
} = chalk
const {
  dim,
} = chalk

export default class Flag extends HelpFormatter {
  public getFlags():string {
    const flags = Object.entries(BaseCommand.baseFlags)
      .filter(([_name, flag]) => !flag.hidden)
      .map(([name, flag]) => {
        flag.name = name
        return flag
      })

    const body = this.flagFormatter(flags)

    return this.section('GLOBAL FLAGS', body)
  }

  protected flagHelpLabel(flag: Command.Flag.Any, showOptions = false): string {
    let label = flag.helpLabel

    if (!label) {
      const labels = []
      if (flag.char) labels.push(`-${flag.char[0]}`)
      if (flag.name) {
        if (flag.type === 'boolean' && flag.allowNo) {
          labels.push(`--[no-]${flag.name.trim()}`)
        } else {
          labels.push(`--${flag.name.trim()}`)
        }
      }

      label = labels.join(', ')
    }

    if (flag.type === 'option') {
      let value = flag.helpValue || (this.opts.showFlagNameInTitle ? flag.name : '<value>')
      if (!flag.helpValue && flag.options) {
        value = showOptions || this.opts.showFlagOptionsInTitle ? `${flag.options.join('|')}` : '<option>'
      }

      if (flag.multiple) value += '...'
      if (!value.includes('|')) value = underline(value)
      label += `=${value}`
    }

    return label
  }

  protected flagFormatter(flags: Array<Command.Flag.Any>): [string, string | undefined][] | undefined {
    if (flags.length === 0) return undefined

    return flags.map(flag => {
      const left = this.flagHelpLabel(flag)

      let right = flag.summary || flag.description || ''
      if (flag.type === 'option' && flag.default) {
        right = `[default: ${flag.default}] ${right}`
      }

      if (flag.required) right = `(required) ${right}`

      if (flag.type === 'option' && flag.options && !flag.helpValue && !this.opts.showFlagOptionsInTitle) {
        right += `\n<options: ${flag.options.join('|')}>`
      }

      return [left, dim(right.trim())]
    })
  }
}
