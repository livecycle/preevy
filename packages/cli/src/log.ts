import { Command } from '@oclif/core'
import { mapValues } from 'lodash'

export const logLevels = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
} as const

export type LogLevel = keyof typeof logLevels

export type LogFunc = (message?: string, ...args: unknown[]) => void

const nullLogFunc: LogFunc = () => undefined

export type Logger = {
  [level in LogLevel]: LogFunc
}

export const commandLogger = (
  command: { logLevel: LogLevel },
  stream: 'stdout' | 'stderr' = 'stdout',
): Logger => {
  const logFunc = (stream === 'stdout' ? Command.prototype.log : Command.prototype.logToStderr).bind(command)
  const commandVal = logLevels[command.logLevel]

  return mapValues(logLevels, val => (val < commandVal ? nullLogFunc : logFunc))
}

export const nullLogger = mapValues(logLevels, () => nullLogFunc)
