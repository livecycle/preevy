import { Config } from '@oclif/core'
import chalk from 'chalk'

export const code = (c: string) => chalk.bold(c)

export const codeList = (c: string[] | readonly string[]) => c.map(code).join(', ')

export const command = ({ bin }: Pick<Config, 'bin'>, ...args: string[]) => code(`${bin} ${args.join(' ')}`)

export const highlight = (s: string) => chalk.greenBright(s)

export const success = (s: string) => chalk.greenBright(s)

export const recommendation = (s: string) => chalk.cyan(s)
