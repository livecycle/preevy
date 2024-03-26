import pino, { Level } from 'pino'

type PinoParams = Parameters<(typeof pino.default<Level>)>[0]
const envToLogger: Record<string, PinoParams> = {
  development: {
    level: process.env.DEBUG ? 'debug' : 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname',
      },
    },
  },
  production: {
    level: process.env.DEBUG ? 'debug' : 'info',
  },
}

export const appLoggerFromEnv = () => envToLogger[process.env.NODE_ENV || 'development']
