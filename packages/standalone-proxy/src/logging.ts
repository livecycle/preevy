import { FastifyBaseLogger, FastifyLoggerOptions, PinoLoggerOptions } from 'fastify/types/logger'

const envToLogger: Record<string, (FastifyLoggerOptions & PinoLoggerOptions) | FastifyBaseLogger | false> = {
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
  test: false,
}

export const appLoggerFromEnv = () => envToLogger[process.env.NODE_ENV || 'development']
