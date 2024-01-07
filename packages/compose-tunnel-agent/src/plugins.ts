import { dockerPlugin } from './plugins/docker/index.js'
import { dockerComposePlugin } from './plugins/docker-compose/index.js'
import { Config } from './configuration/index.js'
import { Plugin, PluginContext } from './configuration/plugins.js'

export const plugins = {
  docker: dockerPlugin,
  'docker-compose': dockerComposePlugin,
} as const

export type Plugins = typeof plugins
export type PluginOpts = (typeof dockerPlugin & typeof dockerComposePlugin)['yargsOpts']

export const pluginOptsFor = <K extends keyof Plugins>(
  keys: K[]
) => Object.assign({}, ...keys.map(k => plugins[k].yargsOpts))

export const allPluginsOpts: PluginOpts = pluginOptsFor(Object.keys(plugins) as (keyof Plugins)[])

export const loadPlugins = async (
  config: Config,
  pluginContextFactory: (pluginName: string) => PluginContext,
): Promise<Record<keyof Plugins, Plugin>> => Object.fromEntries(await Promise.all(
  config.plugin.map(async (pluginName: keyof Plugins) => {
    const pluginFactory = plugins[pluginName]
    const ctx = pluginContextFactory(pluginName)
    const plugin = await pluginFactory.init(config, ctx)
    ctx.log.info(`initialized plugin ${pluginName}`)
    return [pluginName, plugin]
  })
))
