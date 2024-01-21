import { camelCase, pickBy } from 'lodash-es'
import { hideBin } from 'yargs/helpers'
import yaml from 'yaml'
import { InferredOptionTypes } from 'yargs'
import { CamelCasedProperties } from 'type-fest'
import { inspect } from 'util'
import { OptionsObject, ParseResult, mergeParse } from './yargs-helpers.js'
import { opts, Opts } from './opts.js'
import { PluginFactory } from '../plugin-definition.js'

export type Config<O extends OptionsObject = {}> = CamelCasedProperties<InferredOptionTypes<Opts & O>>
export type ConfigParseResult<O extends OptionsObject = {}> = ParseResult<Config<O>>

const pluginOptsFor = <
  YargsOpts extends OptionsObject,
  T extends Record<string, PluginFactory<YargsOpts>>
>(plugins: T, keys: (keyof T)[]) => Object.assign({}, ...keys.map(k => plugins[k].yargsOpts))

export const mergedConfig = async <
  YargsOpts extends OptionsObject,
>(plugins: Record<string, PluginFactory<YargsOpts>>, argv: string[] | string) => {
  const parsedMerged = await mergeParse(
    {
      options: opts(Object.keys(plugins)),
      envPrefix: 'CTA',
      extractConfigFiles: config => config.config ?? [],
      extractExtraOptions: config => pluginOptsFor<YargsOpts, Record<string, PluginFactory<YargsOpts>>>(
        plugins,
        config.plugin ?? [],
      ),
    },
    argv
  ) as ConfigParseResult<YargsOpts>

  if ('result' in parsedMerged && parsedMerged.result.printConfig) {
    const stringifier = parsedMerged.result.printConfig === 'yaml' ? yaml : JSON
    return { output: stringifier.stringify(pickBy(
      parsedMerged.result,
      (_v, k) => k !== '_' && k !== 'printConfig' && !k.startsWith('$') && k === camelCase(k),
    )) }
  }

  return parsedMerged
}

export const readConfig = async <YargsOpts extends Opts>(
  plugins: Record<string, PluginFactory<YargsOpts>>,
  process: Pick<NodeJS.Process, 'stderr' | 'stdout' | 'argv' | 'exit'>,
) => {
  const configParseResult = await mergedConfig<YargsOpts>(plugins, hideBin(process.argv))
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
