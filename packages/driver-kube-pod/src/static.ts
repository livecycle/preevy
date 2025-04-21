import path from 'path'
import url from 'url'


const __dirname = url.fileURLToPath(new URL('.', import.meta.url))

export const DIR = path.join(__dirname, '../static')
export const DEFAULT_TEMPLATE = path.join(DIR, './default-template.yaml.njk')
export const packageJsonPath = path.join(__dirname, '../package.json')
