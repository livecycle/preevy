import { camelCase, mapValues, omit, omitBy } from 'lodash-es'
import yargs, { Argv, InferredOptionTypes, Options } from 'yargs'
import { CamelCasedProperties } from 'type-fest'
import { mergeDeep } from '../merge.js'
import { readJsonOrYaml } from '../files.js'

export type OptionsObject = { [key: string]: Options }

const makePartialOptions = (o: Options) => omit<Options, 'demandOption' | 'default'>(o, 'demandOption', 'default')

export const makePartialOptionsObject = <T extends OptionsObject>(
  o: T,
) => mapValues(o, makePartialOptions)

export const splitCommaSeparatedStringArrays = (
  o: string[],
) => o.flatMap(s => s.split(',').map(p => p.trim()))

const parserConfiguration = { 'greedy-arrays': false } as const

const parser = <T extends OptionsObject>(
  options: T,
  strict: boolean,
  config: Partial<InferredOptionTypes<T>> = {},
) => yargs()
    .parserConfiguration(parserConfiguration)
    .strict(strict)
    .config(config)
    .options(options)

export type ParseResult<T> = { output: string; error: Error }
  | { output: string }
  | { result: CamelCasedProperties<T> }

export const parse = <T>(y: Argv<T>, argv: string[] | string = []) => new Promise<ParseResult<T>>((resolve, reject) => {
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
    resolve({ result: result as CamelCasedProperties<T> })
  })
})

type Iot<T extends OptionsObject> = InferredOptionTypes<T>

export const mergeParse = async <Opts extends OptionsObject, ExtraOpts extends OptionsObject>(
  { options, envPrefix, extractConfigFiles, extractExtraOptions }: {
    options: Opts
    envPrefix: string
    extractConfigFiles: (config: Partial<Iot<Opts>>) => string[]
    extractExtraOptions: (config: Partial<Iot<Opts>>) => Partial<ExtraOpts>
  },
  argv: string[] | string
): Promise<ParseResult<Iot<Opts & ExtraOpts>>> => {
  const partialOpts = makePartialOptionsObject(options)
  const partialParser = (config: Partial<Iot<Opts>> = {}) => parser(partialOpts, false, config).help(false)

  const parsedEnv = await parse(partialParser().env(envPrefix))
  if (!('result' in parsedEnv)) {
    return parsedEnv
  }

  const parsedArgs = await parse(partialParser(), argv)
  if (!('result' in parsedArgs)) {
    return parsedArgs
  }

  let merged: Partial<InferredOptionTypes<Opts & ExtraOpts>> = mergeDeep({}, parsedEnv.result, parsedArgs.result)

  const configFiles = extractConfigFiles(merged)

  if (configFiles.length) {
    const configsFromFiles = await Promise.all(configFiles.map(readJsonOrYaml))
    const parsedFiles = await parse(partialParser(mergeDeep({}, ...configsFromFiles)))
    if (!('result' in parsedFiles)) {
      return parsedFiles
    }
    merged = mergeDeep({}, parsedEnv.result, parsedFiles.result, parsedArgs.result)
  }

  const extra = extractExtraOptions(merged)
  const allOpts = { ...options, ...extra } as Opts & ExtraOpts
  const parseResult = await parse(parser(allOpts, true, merged))
  if (!('result' in parseResult)) {
    return parseResult
  }

  const aliases = new Set(Object.values(allOpts).flatMap(o => o.alias ?? []).map(a => camelCase(a)))
  const resultWithoutAliases = omitBy(parseResult.result, (_, k) => aliases.has(k)) as typeof parseResult.result
  return { result: resultWithoutAliases }
}
