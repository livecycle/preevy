import { Command } from '@oclif/core'
import { Logger, LogLevel, logLevels, nullLogFunc } from '@preevy/core'
import { mapValues } from 'lodash-es'

export const commandLogger = (
  command: { logLevel: LogLevel },
  stream: 'stdout' | 'stderr' = 'stdout',
): Logger => {
  const logFunc = (stream === 'stdout' ? Command.prototype.log : Command.prototype.logToStderr).bind(command)
  const commandVal = logLevels[command.logLevel]

  return mapValues(logLevels, val => (val < commandVal ? nullLogFunc : logFunc))
}

export const nullLogger = mapValues(logLevels, () => nullLogFunc)
