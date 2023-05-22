import { config as coreConfig } from '@preevy/core'
import { InitResults, PluginModule } from './model'
import { PluginInitContext } from './context'
import PreevyPluginConfig = coreConfig.PreevyPluginConfig
import PreevyConfig = coreConfig.PreevyConfig

export type LoadedPlugin = {
  initResults: InitResults
  config: PreevyPluginConfig
}

export const loadPlugins = async (
  preevyConfig: Pick<PreevyConfig, 'plugins'>,
  initArgs: Omit<PluginInitContext, 'preevyConfig' | 'pluginConfig'>,
): Promise<LoadedPlugin[]> => {
  const pluginDefinitions = (preevyConfig.plugins ?? []).filter(p => !p.disabled)

  const plugins = await Promise.all(pluginDefinitions.map(
    async p => ({ plugin: (await import(p.module) as PluginModule).preevyPlugin, config: p }),
  ))

  return Promise.all(
    plugins.map(async p => ({
      initResults: await p.plugin.init({ ...initArgs, preevyConfig, pluginConfig: p.config }),
      config: p.config,
    })),
  )
}
