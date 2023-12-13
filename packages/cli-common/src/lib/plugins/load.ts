import { Config } from '@oclif/core'
import { InferredFlags } from '@oclif/core/lib/interfaces'
import { config as coreConfig } from '@preevy/core'
import { InitResults, PluginModule } from './model.js'
import { PluginInitContext } from './context.js'
import PreevyPluginConfig = coreConfig.PreevyPluginConfig
import { pluginFlags } from '../common-flags/index.js'
import { DEFAULT_PLUGINS } from './default-plugins.js'

export type LoadedPlugin = {
  initResults: InitResults
  config: PreevyPluginConfig
}

const mergePluginDefs = (
  envConfig: Pick<Config, 'scopedEnvVar' | 'scopedEnvVarKey'>,
  flags: InferredFlags<typeof pluginFlags>,
  pluginConfig: PreevyPluginConfig[] | undefined,
) => {
  const pluginDefinitions = DEFAULT_PLUGINS.map(m => ({ module: m }))
    .concat(pluginConfig ?? [])
    .concat(envConfig.scopedEnvVar('ENABLE_PLUGINS')?.split(',')?.map(m => ({ module: m })) ?? [])
    .concat(envConfig.scopedEnvVar('DISABLE_PLUGINS')?.split(',')?.map(m => ({ module: m, disabled: true })) ?? [])
    .concat(flags['enable-plugin']?.map(m => ({ module: m })) ?? [])
    .concat(flags['disable-plugin']?.map(m => ({ module: m, disabled: true })) ?? [])
    .map(p => [p.module, p] as [string, PreevyPluginConfig])
    .reduce((acc, [k, v]) => ({ ...acc, ...{ [k]: v } }), {} as Record<string, PreevyPluginConfig>)

  return Object.values(pluginDefinitions).filter(({ disabled }) => !disabled)
}

export const loadPlugins = async (
  envConfig: Pick<Config, 'scopedEnvVar' | 'scopedEnvVarKey'>,
  flags: InferredFlags<typeof pluginFlags>,
  pluginConfig: PreevyPluginConfig[] | undefined,
  initArgs: Omit<PluginInitContext, 'pluginConfig'>,
): Promise<LoadedPlugin[]> => {
  const pluginDefinitions = mergePluginDefs(envConfig, flags, pluginConfig)

  const plugins = await Promise.all(pluginDefinitions.map(
    async p => ({ plugin: (await import(p.module) as PluginModule).preevyPlugin, config: p }),
  ))

  return await Promise.all(
    plugins.map(async p => ({
      initResults: await p.plugin.init({ ...initArgs, pluginConfig: p.config }),
      config: p.config,
    })),
  )
}
