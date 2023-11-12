import z from 'zod'

export const localBuildSpecSchema = z.object({
  registry: z.string().describe('registry to use'),
  platform: z.string().optional().describe('platform to build for (default: driver platform)'),
  ecrFormat: z.boolean().optional().describe('use ECR format (default: auto detect)'),
  cacheToLatest: z.boolean().default(false).describe('enable cache-to with latest tag (default: false)'),
})

export type LocalBuildSpec = z.infer<typeof localBuildSpecSchema>
