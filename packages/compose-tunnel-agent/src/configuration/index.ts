import { hideBin } from 'yargs/helpers'
import yaml from 'yaml'
import { inspect } from 'util'
import { pluginOptsFor } from '../plugins.js'
import { mergeParse } from './yargs-helpers.js'
import { ConfigParseResult, opts } from './opts.js'

export { Config, ConfigParseResult } from './opts.js'
export { Plugin } from './plugins.js'

export const mergedConfig = async (argv: string[] | string) => {
  const parsedMerged = await mergeParse(
    opts,
    'CTA',
    config => config.config ?? [],
    config => pluginOptsFor(config.plugin ?? []),
    argv,
  ) as ConfigParseResult

  if ('result' in parsedMerged && parsedMerged.result.printConfig) {
    const stringifier = parsedMerged.result.printConfig === 'yaml' ? yaml : JSON
    return { output: stringifier.stringify(parsedMerged.result) }
  }

  return parsedMerged
}

export const readConfig = async (process: Pick<NodeJS.Process, 'stderr' | 'stdout' | 'argv' | 'exit'>) => {
  const configParseResult = await mergedConfig(hideBin(process.argv))
  if ('output' in configParseResult) {
    const error = ('error' in configParseResult) ? configParseResult.error : undefined
    const outStream = error ? process.stderr : process.stdout
    outStream.write(configParseResult.output || error?.message || inspect(error))
  }
  if (!('result' in configParseResult)) {
    process.exit(1)
  }

  return configParseResult.result
}
