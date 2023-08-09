import fs from 'fs'
import { Logger } from '@preevy/common'
import { merge } from 'lodash'
import { inspect } from 'util'

export const envMetadata = async ({ env, log }: { env: NodeJS.ProcessEnv; log: Logger }) => {
  const jsons = [
    ...await Promise.all(
      (env.ENV_METADATA_FILES || '')
        .split(' ')
        .map(async f => {
          try {
            return await fs.promises.readFile(f, { encoding: 'utf8' })
          } catch (err) {
            log.warn('error reading env metadata from file "%s": %j', f, inspect(err))
            return undefined
          }
        })
    ),
    env.ENV_METADATA,
  ]

  const objects = jsons.map((s, i) => {
    try {
      if (s === undefined) return undefined
      return JSON.parse(s) as Record<string, unknown>
    } catch (err) {
      log.warn('error reading env metadta from JSON %d %s: %j', i, s, inspect(err))
      return undefined
    }
  })

  return merge({}, ...objects.filter(Boolean))
}
