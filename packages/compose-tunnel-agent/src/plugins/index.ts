import { dockerPlugin } from './docker/index.js'
import { dockerComposePlugin } from './docker-compose/index.js'
import { Config } from '../configuration/index.js'
import { Plugin, PluginContext } from '../plugin-definition.js'

export type PluginOpts = (typeof dockerPlugin & typeof dockerComposePlugin)['yargsOpts']
export const pluginFactories = {
  docker: dockerPlugin,
  'docker-compose': dockerComposePlugin,
} as const

export type PluginFactories = typeof pluginFactories

export const loadPlugins = async (
  config: Config<PluginOpts>,
  pluginContextFactory: (pluginName: string) => PluginContext,
): Promise<Record<string, Plugin>> => Object.fromEntries(await Promise.all(
  config.plugin.map(async (pluginName: string) => {
    const pluginFactory = pluginFactories[pluginName as keyof PluginFactories]
    if (!pluginFactories) {
      throw new Error(`unknown plugin: "${pluginName}"`)
    }
    const ctx = pluginContextFactory(pluginName)
    const plugin = await pluginFactory.init(config, ctx)
    ctx.log.info(`initialized plugin ${pluginName}`)
    return [pluginName, plugin]
  })
))
