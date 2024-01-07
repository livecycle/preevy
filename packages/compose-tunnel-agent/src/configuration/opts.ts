import fs from 'fs'
import { InferredOptionTypes } from 'yargs'
import { CamelCasedProperties } from 'type-fest'
import z from 'zod'
import { ScriptInjection, generateSchemaErrorMessage, machineStatusCommandSchema, parseScriptInjection } from '@preevy/common'
import { inspect } from 'util'
import { Forward, forwardSchema } from '../forwards.js'
import { PluginOpts, Plugins, plugins } from '../plugins.js'
import { mergeDeep } from '../merge.js'
import { OptionsObject, ParseResult, splitCommaSeparatedStringArrays } from './yargs-helpers.js'

export const accessSchema = z.union([z.literal('private'), z.literal('public')])
export type Access = z.infer<typeof accessSchema>
export const logLevelSchema = z.union([z.literal('debug'), z.literal('info'), z.literal('warn'), z.literal('error')])

const tunnelServerGroup = 'Tunnel server connection'
const logGroup = 'Logging'

export const opts = {
  config: {
    array: true,
    string: true,
    description: 'Load config from specified YAML/JSON file',
    coerce: splitCommaSeparatedStringArrays,
  },
  printConfig: {
    description: 'Print config in specified format (default: JSON) and exit',
    choices: [true, 'json', 'yaml'],
  },
  'env-id': {
    string: true,
    description: 'Environment ID',
    demandOption: true,
  },
  'env-metadata': {
    description: 'Environment metadata as JSON or dot object',
    coerce: (...values: (string | {})[]): Record<string, unknown> => mergeDeep(
      {},
      ...values.map(v => (typeof v === 'string' ? JSON.parse(v) : v)),
    ),
  },
  'log-level': {
    group: logGroup,
    type: 'string',
    choices: logLevelSchema.options.map(o => o.value),
    description: 'Log level',
  },
  debug: {
    group: logGroup,
    type: 'boolean',
    description: 'Debug mode',
  },
  'log-pretty': {
    group: logGroup,
    type: 'boolean',
    description: 'Prettify log output',
    default: process.stderr.isTTY,
    defaultDescription: 'if stderr is a TTY',
  },
  defaultAccess: {
    choices: accessSchema.options.map(o => o.value),
    coerce: (v: string) => v as Access,
    default: 'public',
  },
  'global-injects': {
    coerce: (o: {}) => {
      if (typeof o !== 'object') {
        throw new Error('Invalid global script injections - use dot notation to specify an object')
      }
      Object.entries(o).forEach(([k, v]) => {
        if (typeof v !== 'object') {
          throw new Error(`Invalid global script injections - expected "${k}" to be an object, received ${inspect(v)}`)
        }
      })
      const result = Object.values(o).map(v => parseScriptInjection(v as Record<string, string>))
      const errors = result.filter(r => r instanceof Error)
      if (errors.length) {
        throw new Error(`Invalid global script injections: ${errors.join(', ')}`)
      }
      return result as ScriptInjection[]
    },
    description: 'Global script injections',
    default: [],
  },
  'machine-status-command': {
    coerce: (o: {}) => {
      if (typeof o !== 'object') {
        throw new Error('Invalid machine status command - use dot notation to specify an object')
      }
      const result = machineStatusCommandSchema.safeParse(o)
      if (!result.success) {
        // eslint-disable-next-line no-underscore-dangle
        throw new Error(`Invalid machine status command: ${inspect(o)}: ${generateSchemaErrorMessage(result.error)}`, { cause: result.error })
      }
      return result.data
    },
    description: 'Machine status command',
  },
  listen: {
    alias: 'port',
    description: 'Port number or unix socket path to listen on',
    default: 3000,
  },
  server: {
    group: tunnelServerGroup,
    type: 'string',
    description: 'URL to tunnel server, specify ssh://hostname[:port] or ssh+tls://hostname[:port]',
    demandOption: true,
    default: 'ssh+tls://livecycle.run',
  },
  'private-key': {
    group: tunnelServerGroup,
    coerce: async (pathOrValue: string) => (
      pathOrValue.includes('BEGIN ') ? pathOrValue : await fs.promises.readFile(pathOrValue, 'utf-8')
    ),
    description: 'Path to SSH private key',
    demandOption: true,
    default: `${process.env.HOME}/.ssh/id_rsa`,
    defaultDescription: '~/.ssh/id_rsa',
  },
  'insecure-skip-verify': {
    group: tunnelServerGroup,
    type: 'boolean',
    description: 'Skip verification of SSH host key',
  },
  'tls-server-name': {
    group: tunnelServerGroup,
    string: true,
    description: 'Override server name for TLS connections',
  },
  'server-key': {
    group: tunnelServerGroup,
    array: true,
    string: true,
    description: 'Known server key',
    default: [] as string[],
  },
  forwards: {
    coerce: (o: {}): Forward[] => {
      if (typeof o !== 'object') {
        throw new Error('Invalid forwards - use dot notation to specify an object')
      }
      Object.entries(o).forEach(([k, v]) => {
        if (typeof v !== 'object') {
          throw new Error(`Invalid forwards - expected "${k}" to be an object, received ${inspect(v)}`)
        }
      })
      const result = z.array(forwardSchema(z.object({}))).safeParse(Object.values(o))
      if (!result.success) {
        throw new Error(`Invalid forwards: ${inspect(o)}: ${generateSchemaErrorMessage(result.error)}`, { cause: result.error })
      }
      return result.data
    },
    default: [] as Forward[],
  },
  plugin: {
    array: true,
    choices: Object.keys(plugins),
    coerce: (o: string[]) => splitCommaSeparatedStringArrays(o) as (keyof Plugins)[],
    default: [],
  },
} as const

export type Opts = typeof opts

export type Config<O extends OptionsObject = PluginOpts> = CamelCasedProperties<InferredOptionTypes<Opts & O>>
export type ConfigParseResult = ParseResult<Config>
