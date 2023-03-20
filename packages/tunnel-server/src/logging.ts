import { PinoLoggerOptions } from 'fastify/types/logger'

const envToLogger: Record<string, PinoLoggerOptions> = {
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
  }
}

export const appLoggerFromEnv = () => envToLogger[process.env.NODE_ENV || 'development']
