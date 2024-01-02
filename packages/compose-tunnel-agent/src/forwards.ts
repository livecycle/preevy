import z from 'zod'
import { IEventEmitter } from 'tseep'
import { scriptInjectionSchema } from '@preevy/common'

export const forwardSchema = <Meta extends z.AnyZodObject>(meta: Meta) => z.object({
  host: z.string(),
  port: z.number(),
  externalName: z.string(),
  meta: meta.passthrough(),
  access: z.union([z.literal('private'), z.literal('public')]).optional(),
  injects: z.array(scriptInjectionSchema).optional(),
})

export type Forward<Meta extends {} = {}> = z.infer<ReturnType<typeof forwardSchema<z.ZodObject<Meta>>>>

export type ForwardsEvents = {
  forwards: (forwards: Forward[]) => void
}

export type ForwardsEmitter = AsyncDisposable & IEventEmitter<ForwardsEvents>
