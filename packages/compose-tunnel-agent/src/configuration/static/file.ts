import fs from 'fs'
import yaml from 'yaml'
import { partialConfigSchema } from '../schema/index.js'

const isYaml = (path: string) => /\.ya?ml$/.test(path)

export const fromFile = async (path: string) => {
  try {
    const s = await fs.promises.readFile(path, 'utf-8')
    const o = isYaml(path) ? yaml.parse(s) : JSON.parse(s)
    return await partialConfigSchema.parseAsync(o)
  } catch (e) {
    throw new Error(`Error reading config file ${path}: ${e}`, { cause: e })
  }
}
