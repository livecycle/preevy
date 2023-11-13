import z from 'zod'

const trueValues: unknown[] = [true, 1].flatMap(x => [x, String(x)])
const booleanStr = () => z.preprocess(v => trueValues.includes(v), z.boolean())

export const localBuildSpecSchema = z.object({
  registry: z.string().describe('registry to use'),
  platform: z.string().optional().describe('platform to build for (default: driver platform)'),
  ecrFormat: booleanStr().optional().describe('use ECR format (default: auto detect)'),
  cacheToLatest: booleanStr().default(false).describe('enable cache-to with latest tag (default: false)'),
})

export type LocalBuildSpec = z.infer<typeof localBuildSpecSchema>
