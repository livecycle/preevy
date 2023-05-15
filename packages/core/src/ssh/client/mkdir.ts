import shellEscape from 'shell-escape'
import { CommandExecuter } from './exec'

export const mkdir = (
  exec: CommandExecuter,
) => (...dirs: string[]) => exec(dirs.map(dir => `mkdir -p ${shellEscape([dir])}`).join(' && '))
