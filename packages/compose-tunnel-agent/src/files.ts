import fs from 'fs'
import yaml from 'yaml'

const isYaml = (filename: string) => /\.ya?ml$/.test(filename)

export const readJsonOrYaml = async (filename: string) => {
  const s = await fs.promises.readFile(filename, 'utf-8')
  return isYaml(filename) ? yaml.parse(s) : JSON.parse(s)
}
