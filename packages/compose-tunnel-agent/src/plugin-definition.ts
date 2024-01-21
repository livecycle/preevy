import { CamelCasedProperties } from 'type-fest'
import { InferredOptionTypes } from 'yargs'
import { DockerMachineStatusCommandRecipe, Logger, TunnelNameResolver } from '@preevy/common'
import { FastifyPluginAsync } from 'fastify'
import { ForwardsEmitter } from './forwards.js'
import { OptionsObject } from './configuration/yargs-helpers.js'

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
  T extends Plugin = Plugin,
> = {
  yargsOpts: YargsOpts
  init: (config: CamelCasedProperties<InferredOptionTypes<YargsOpts>>, ctx: PluginContext) => Promise<T>
}
