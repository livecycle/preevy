import fs from 'fs'
import yaml from 'yaml'
import { MergeWithCustomizer, mergeWith } from 'lodash'
import { PreevyConfig } from './model'

export { PreevyConfig, PreevyPluginConfig } from './model'

const loadConfigFile = async (path: string): Promise<PreevyConfig> => {
  const contents = await fs.promises.readFile(path, 'utf8')
  if (path.endsWith('.json')) {
    return JSON.parse(contents)
  }
  return yaml.parse(contents)
}

const customizer: MergeWithCustomizer = (obj, source) => {
  if (Array.isArray(source) && Array.isArray(obj)) {
    return obj.concat(source)
  }
  return undefined
}

export const DEFAULT_PATHS = [
  'preevy.yaml',
  'preevy.yml',
  'preevy.json',
]

export const loadConfig = async (paths: string[], userModel: { 'x-preevy'?: PreevyConfig }): Promise<PreevyConfig> => {
  const normalizedPaths = paths.length > 0
    ? paths
    : [DEFAULT_PATHS.find(fs.existsSync)].filter(Boolean) as string[]

  const configs = await Promise.all(normalizedPaths.map(loadConfigFile))
  return [...configs, userModel?.['x-preevy'] ?? {}].reduce(
    (acc, config) => mergeWith(acc, config, customizer),
    {},
  )
}
