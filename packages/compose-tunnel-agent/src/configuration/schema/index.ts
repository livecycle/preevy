import { COMPOSE_TUNNEL_AGENT_PORT, containerScriptInjectionSchema, machineStatusCommandSchema, sshConnectionConfigSchema } from '@preevy/common'
import { mapValues } from 'lodash-es'
import z from 'zod'

export const accessSchema = z.union([z.literal('private'), z.literal('public')])

export const logLevelSchema = z.union([z.literal('debug'), z.literal('info'), z.literal('warn'), z.literal('error')])

const configSchemaShape = {
  // configFile: z.string().optional(),
  logLevel: logLevelSchema,
  debug: z.boolean(),
  logPretty: z.boolean(),
  sshUrl: z.string().url(),
  sshPrivateKey: z.union([z.instanceof(Buffer), z.string()]),
  sshInsecureSkipVerify: z.boolean(),
  sshKnownServerKeys: z.array(z.union([z.instanceof(Buffer), z.string()])),
  envId: z.string(),
  providers: z.array(z.string()),
  defaultAccess: accessSchema.default('public'),
  globalInjects: z.array(containerScriptInjectionSchema).default([]),
  listen: z.union([z.coerce.number(), z.string()]).default(COMPOSE_TUNNEL_AGENT_PORT),
  machineStatusCommand: machineStatusCommandSchema.optional(),
} as const

export const configSchema = z.object(configSchemaShape)

export const partialConfigSchema = z.object(
  mapValues(configSchemaShape, s => s.optional())
)

export type Config = z.infer<typeof configSchema>

// type PartialNested<T> = T extends {} ? { [K in keyof T]?: PartialNested<T[K]> } : T

export type PartialConfig = z.infer<typeof partialConfigSchema>
