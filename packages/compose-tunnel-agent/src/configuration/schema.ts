import { PartialDeep } from 'type-fest'
import { scriptInjectionSchema, machineStatusCommandSchema, Logger, TunnelNameResolver } from '@preevy/common'
import z from 'zod'
import { InferredOptionTypes, Options } from 'yargs'
import { FastifyPluginAsync } from 'fastify'
import { ForwardsEmitter, forwardSchema } from '../forwards.js'

export const accessSchema = z.union([z.literal('private'), z.literal('public')])
export type Access = z.infer<typeof accessSchema>

export const logLevelSchema = z.union([z.literal('debug'), z.literal('info'), z.literal('warn'), z.literal('error')])

export type PluginContext = { log: Logger; tunnelNameResolver: TunnelNameResolver }

export type Plugin = {
  forwardsEmitter?: (ctx: PluginContext) => ForwardsEmitter | Promise<ForwardsEmitter>
  fastifyPlugin?: FastifyPluginAsync<PluginContext>
}

export type PluginFactory<
  YargsOpts extends { [key: string]: Options } = {},
> = {
  yargsOpts: YargsOpts
  init: (config: InferredOptionTypes<YargsOpts>) => Promise<Plugin>
}

export const configSchema = z.object({
  logLevel: logLevelSchema,
  debug: z.boolean(),
  logPretty: z.boolean(),
  sshUrl: z.string().url(),
  sshPrivateKey: z.union([z.instanceof(Buffer), z.string()]),
  sshInsecureSkipVerify: z.boolean(),
  sshKnownServerKeys: z.array(z.union([z.instanceof(Buffer), z.string()])),
  envId: z.string(),
  providers: z.array(z.string()),
  defaultAccess: accessSchema,
  globalInjects: z.array(scriptInjectionSchema),
  listen: z.union([z.coerce.number(), z.string()]),
  machineStatusCommand: machineStatusCommandSchema.optional(),
  forwards: z.array(forwardSchema(z.object({}))).optional(),
  plugins: z.record(z.string(), z.object({}).passthrough()).optional(),
})

export const partialConfigSchema = configSchema.partial()
export type Config = z.infer<typeof configSchema>
export type PartialConfig = PartialDeep<z.infer<typeof configSchema>>
