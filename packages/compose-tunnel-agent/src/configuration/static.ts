import fs from 'fs'
import yaml from 'yaml'
import yargs, { Argv, InferredOptionTypes, Options } from 'yargs'
import z from 'zod'
import { ScriptInjection, generateSchemaErrorMessage, machineStatusCommandSchema, parseScriptInjection, parseSshUrl } from '@preevy/common'
import { inspect } from 'util'
import { mapValues, mergeWith, pickBy } from 'lodash-es'
import { PartialConfig, configSchema, logLevelSchema } from './schema.js'
import { readAllFiles } from '../files.js'
import { forwardSchema } from '../forwards.js'
import { dockerPlugin } from '../plugins/docker/index.js'

const isYaml = (path: string) => /\.ya?ml$/.test(path)

const sshGroup = 'SSH connection'
const logGroup = 'Logging'

const plugins = {
  docker: dockerPlugin,
} as const

const opts = {
  config: {
    type: 'string',
    description: 'Load config from specified YAML/JSON file',
  },
  printConfig: {
    description: 'Print config in specified format (default: JSON) and exit',
    choices: [true, 'json', 'yaml'],
  },
  'env-id': {
    type: 'string',
    description: 'Environment ID',
    demandOption: true,
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
    coerce: (pathOrValue: string) => (
      pathOrValue.includes('BEGIN ') ? pathOrValue : fs.promises.readFile(pathOrValue, 'utf-8')
    ),
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
  forwards: {
    coerce: (o: {}) => {
      if (typeof o !== 'object') {
        throw new Error('Invalid forwards - use dot notation to specify an object')
      }
      Object.entries(o).forEach(([k, v]) => {
        if (typeof v !== 'object') {
          throw new Error(`Invalid forwards - expected "${k}" to be an object, received ${inspect(v)}`)
        }
      })
      const result = forwardSchema(z.object({})).safeParse(Object.values(o))
      if (!result.success) {
        throw new Error(`Invalid forwards: ${inspect(o)}: ${generateSchemaErrorMessage(result.error)}`, { cause: result.error })
      }
      return result.data
    },
  },
  plugins: {
    choices: Object.keys(plugins),
  },
} as const

export const partialOpts = mapValues(opts, o => ({ ...o, demandOption: false, coerce: undefined }))

type PartialConfigWithArgs = PartialConfig & { config?: string; printConfig?: boolean | 'json' | 'yaml' }

const parserConfiguration = { 'greedy-arrays': false } as const

const parser = <ExtraOpts extends Record<string, Options>>(
  extraOpts: ExtraOpts,
  config: InferredOptionTypes<typeof opts & ExtraOpts>,
) => yargs()
    .parserConfiguration(parserConfiguration)
    .strict(true)
    .config(config)
    .options({ ...opts, ...extraOpts })

const partialParser = (config: Record<string, unknown> = {}) => yargs()
  .parserConfiguration(parserConfiguration)
  .strict(false)
  .config(config)
  .options(partialOpts) as Argv<Partial<InferredOptionTypes<typeof partialOpts>>>

export type ParseResult<T> = { output: string; error: Error }
  | { output: string }
  | { result: T }

const parse = <T>(y: Argv<T>, argv: string[] | string = []) => new Promise<ParseResult<T>>((resolve, reject) => {
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

const mergeDeep = <TObject, TSource>(
  obj: TObject,
  ...src: TSource[]
) => mergeWith(
  obj,
  ...src,
  (a: unknown, b: unknown) => (
    Array.isArray(a) && Array.isArray(b) ? a.concat(b) : undefined
  )
) as TObject & TSource

const configSchemaKeys = new Set(Object.keys(configSchema.shape))
const pickConfigSchemaKeys = (o: PartialConfig) => pickBy(o, (_v, k) => configSchemaKeys.has(k)) as PartialConfig

const readFile = async (filename: string) => {
  const s = await fs.promises.readFile(filename, 'utf-8')
  return isYaml(filename) ? yaml.parse(s) : JSON.parse(s)
}

export const mergedConfig = async (argv: string[] | string) => {
  const parsedArgs = await parse(partialParser(), argv)
  if (!('result' in parsedArgs)) {
    return parsedArgs
  }

  const { config: configFile, ...parsedArgsResult } = parsedArgs.result

  let parsedFileResult: PartialConfig = {}
  if (configFile) {
    const parsedFile = await parse(partialParser(await readFile(configFile)))
    if (!('result' in parsedFile)) {
      return parsedFile
    }
    parsedFileResult = parsedFile.result
  }

  const parsedEnv = await parse(partialParser().env('CTA'))
  const parsedEnvResult = 'result' in parsedEnv ? parsedEnv.result : {}

  const merged = mergeDeep(parsedEnvResult, parsedFileResult, parsedArgsResult)
  const providerOpts = Object.assign(...merged.plugins?.map(plugin => plugins[plugin as keyof typeof plugins].yargsOpts))
  const parsedMerged = await parse(parser({}, merged))

  if ('result' in parsedMerged && parsedMerged.result.printConfig) {
    const config = pickConfigSchemaKeys(parsedMerged.result)
    const stringifier = parsedMerged.result.printConfig === 'yaml' ? yaml : JSON
    return { output: stringifier.stringify(config) }
  }

  return parsedMerged
}
