import z from 'zod'

export const splitBuildSpecSchema = z.object({
  registry: z.string(),
  platform: z.string().optional(),
  ecrFormat: z.boolean().optional(),
})

export type SplitBuildSpec = z.infer<typeof splitBuildSpecSchema>
