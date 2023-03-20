const logLevels = ['debug', 'info', 'warn', 'error'] as const
type LogLevel = typeof logLevels[number]

export type Logger = {
  [level in LogLevel]: (msg: string, ...args: unknown[]) => void
}
