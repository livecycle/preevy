import pinoPrettyModule from 'pino-pretty'
import { pino } from 'pino'
import { Config } from './configuration/index.js'

const PinoPretty = pinoPrettyModule.default

export const createLog = (
  { stderr }: { stderr: NodeJS.WritableStream & { isTTy?: boolean } },
  { logLevel = 'info', debug, logPretty }: Partial<Pick<Config, 'logLevel' | 'debug' | 'logPretty'>> = {},
) => pino({
  level: debug ? 'debug' : logLevel,
}, (logPretty === true || stderr.isTTy) ? PinoPretty({ destination: pino.destination(stderr) }) : stderr)
