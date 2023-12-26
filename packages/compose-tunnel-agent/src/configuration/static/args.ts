import fs from 'fs'
import yaml from 'yaml'
import yargs, { Argv } from 'yargs'
import { generateErrorMessage } from 'zod-error'
import { ContainerScriptInjection, machineStatusCommandSchema, parseScriptInjection, parseSshUrl } from '@preevy/common'
import { kebabCase } from 'lodash-es'
import { inspect } from 'util'
import { PartialConfig, logLevelSchema } from '../schema/index.js'
import { partialConfigSchema } from '../schema/index.js'
import { readAllFiles } from '../../files.js'

const isYaml = (path: string) => /\.ya?ml$/.test(path)

export const fromFile = async (path: string) => {
  try {
    const s = await fs.promises.readFile(path, 'utf-8')
    const o = isYaml(path) ? yaml.parse(s) : JSON.parse(s)
    return await partialConfigSchema.parseAsync(o)
  } catch (e) {
    throw new Error(`Error reading config file ${path}: ${e}`, { cause: e })
  }
}

const sshGroup = 'SSH connection'
const logGroup = 'Logging'

const zodErrorOpts = {
  delimiter: { error: '; ', component: ': ' },
  code: { enabled: false },
  path: { enabled: true, type: 'objectNotation', label: '' },
  message: { enabled: true, label: '' },
} as const

export const opts = {
  'env-id': {
    type: 'string',
    description: 'Environment ID',
    demandOption: true,
  },
  config: {
    type: 'string',
    description: 'Load config from specified YAML/JSON file',
    config: true,
    configParser: (path: string) => {
      const s = fs.readFileSync(path, 'utf-8')
      return isYaml(path) ? yaml.parse(s) : JSON.parse(s)
    },
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
    defaultDescription: 'if stderr is TTY',
  },
  'global-inject': {
    coerce: (o: {}) => {
      if (typeof o !== 'object') {
        throw new Error('Invalid global script injections - use dot notation to specify an object')
      }
      Object.entries(o).forEach(([k, v]) => {
        if (typeof v !== 'object') {
          throw new Error(`Invalid global script injections - expected "${k}" to be an object, received ${inspect(v)}`)
        }
      })
      const result = Object.values(o).map(v => parseScriptInjection(v as Record<string, string>, kebabCase))
      const errors = result.filter(r => r instanceof Error)
      if (errors.length) {
        throw new Error(`Invalid global script injections: ${errors.join(', ')}`)
      }
      return result as ContainerScriptInjection[]
    },
    description: 'Global script injections',
  },
  'machine-status-command': {
    coerce: (o: {}) => {
      if (typeof o !== 'object') {
        throw new Error('Invalid machine status command - use dot notation to specify an object')
      }
      const result = machineStatusCommandSchema.safeParse(o)
      if (!result.success) {
        // eslint-disable-next-line no-underscore-dangle
        throw new Error(`Invalid machine status command: ${inspect(o)}: ${generateErrorMessage(result.error.issues, zodErrorOpts)}`, { cause: result.error })
      }
      return result.data
    },
    description: 'Machine status command',
  },
  listen: {
    alias: 'port',
    description: 'Port number or unix socket path to listen on',
  },
  'ssh-url': {
    group: sshGroup,
    type: 'string',
    description: 'URL to tunnel server, specify ssh://hostname[:port] or ssh+tls://hostname[:port]',
    demandOption: true,
    coerce: parseSshUrl,
  },
  'ssh-private-key': {
    group: sshGroup,
    type: 'string',
    coerce: (pathOrValue: string) => (pathOrValue.includes('BEGIN ')
      ? pathOrValue
      : fs.promises.readFile(pathOrValue, 'utf-8')),
    description: 'Path to SSH private key',
    demandOption: true,
  },
  'ssh-insecure-skip-verify': {
    group: sshGroup,
    type: 'boolean',
    description: 'Skip verification of SSH host key',
  },
  'ssh-tls-server-name': {
    group: sshGroup,
    type: 'string',
    description: 'Override server name for TLS connections',
  },
  'ssh-known-server-keys': {
    group: sshGroup,
    type: 'string',
    description: 'Directory with known server keys, used with non-TLS connections',
    coerse: (f: string) => readAllFiles(f),
  },
} as const

const parser = yargs()
  .parserConfiguration({ 'greedy-arrays': false })
  .env('CTA')
  .strict()
  .options(opts)

export type ParseResult<T> = { output: string; error: Error }
  | { output: string }
  | { result: T }

const parsePromise = <T>(y: Argv<T>, argv: string[]) => new Promise<ParseResult<T>>((resolve, reject) => {
  void y.parseAsync(argv, async (error: Error, result: T, output: string) => {
    if (error && error.name !== 'YError') {
      reject(error)
      return
    }
    if (error) {
      resolve({ output, error })
      return
    }
    if (output) {
      resolve({ output })
      return
    }
    resolve({ result })
  })
})

export const fromArgs = (argv: string[]) => parsePromise(parser as Argv<PartialConfig>, argv)
