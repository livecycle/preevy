export const logLevels = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
} as const

export type LogLevel = keyof typeof logLevels

export type LogFunc = (message?: string, ...args: unknown[]) => void

export const nullLogFunc: LogFunc = () => undefined

export type Logger = {
  [level in LogLevel]: LogFunc
}
