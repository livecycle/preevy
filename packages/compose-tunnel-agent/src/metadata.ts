import fs from 'fs'
import { Logger } from '@preevy/common'
import { merge } from 'lodash-es'
import { inspect } from 'util'

const parseMetadataFileLis = (s?: string): string[] => {
  if (!s) return []
  try {
    const result = JSON.parse(s)
    if (!Array.isArray(result) || !result.every(v => typeof v === 'string')) {
      throw new Error(`invalid metadata file list, expected a comma-separated string, or a JSON array of strings: ${s}`)
    }
    return result
  } catch (e) {
    return s.split(' ')
  }
}

export const envMetadata = async ({ env, log }: { env: NodeJS.ProcessEnv; log: Logger }) => {
  const jsons = [
    ...await Promise.all(
      parseMetadataFileLis(env.ENV_METADATA_FILES)
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
