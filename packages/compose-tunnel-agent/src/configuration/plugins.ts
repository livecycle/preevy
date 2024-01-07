import { DockerMachineStatusCommandRecipe, Logger, TunnelNameResolver } from '@preevy/common'
import { FastifyPluginAsync } from 'fastify'
import { ForwardsEmitter } from '../forwards.js'
import { Config } from './opts.js'
import { OptionsObject } from './yargs-helpers.js'

export type PluginContext = { log: Logger }

export type MachineStatusCommandRunner = (
  recipe: DockerMachineStatusCommandRecipe,
) => Promise<Buffer>

type RecipeType = string

export type Plugin = {
  forwardsEmitter?: (opts: { tunnelNameResolver: TunnelNameResolver }) => Promise<ForwardsEmitter>
  fastifyPlugin?: FastifyPluginAsync
  machineStatusCommands?: Record<RecipeType, MachineStatusCommandRunner>
}

export type PluginFactory<
  YargsOpts extends OptionsObject = {},
> = {
  yargsOpts: YargsOpts
  init: (config: Config<YargsOpts>, ctx: PluginContext) => Promise<Plugin>
}
