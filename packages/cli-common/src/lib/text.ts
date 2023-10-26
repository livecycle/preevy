import { Config } from '@oclif/core'
import chalk from 'chalk'
import { EOL } from 'os'

export const code = (c: string) => chalk.bold(c)

export const codeList = (c: string[] | readonly string[]) => c.map(code).join(', ')

export const command = ({ bin }: Pick<Config, 'bin'>, ...args: string[]) => code(`${bin} ${args.join(' ')}`)

export const highlight = (s: string) => chalk.greenBright(s)

export const success = (s: string) => chalk.greenBright(s)

export const recommendation = (s: string) => chalk.cyan(s)

const mag = chalk.rgb(255, 128, 197)

export const logo = [
  '',
  `${mag('@@@@')} @@@@`,
  `${mag('@@@@@')}@@@@@@`,
  `${mag('@@@@@')}@@@@@@@@    @@@@@@@@@@`,
  `${mag('@@@@@')}@@@@@@@@@   @@@     @@@ @@ @@@   @@@@@%     @@@@@   @@     @@@ @@@    @@@`,
  `${mag('@@@@@')}@@@@@@@@@   @@@    @@@  @@@@   @@@   @@@  @@@   @@@ @@@   @@@   @@@  @@@`,
  `${mag('@@@@@@@@@')}        @@@@@@@@@   @@     @@@@@@@@@  @@@@@@@@@  @@@  @@     @@  @@`,
  `${mag('@@@@@@@@@')}        @@@         @@     @@@        @@@         @@@@@@      @@@@`,
  ` ${mag('@@@@@@@@')}        @@@         @@      @@@@@@@@   @@@@@@@@    @@@@       @@@@`,
  `   ${mag('@@@@@@')}                                                              @@@`,
  `      ${mag('@@@')}                                                           @@@@@`,
  '',
].join(EOL)

export const { supportsColor } = chalk
