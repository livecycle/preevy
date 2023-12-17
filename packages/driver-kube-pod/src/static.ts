import path from 'path'
import url from 'url'
import packageJsonImport from '../package.json' assert { type: 'json' }

// eslint-disable-next-line no-underscore-dangle
const __dirname = url.fileURLToPath(new URL('.', import.meta.url))

export const DIR = path.join(__dirname, '../static')
export const DEFAULT_TEMPLATE = path.join(DIR, './default-template.yaml.njk')
export const packageJson = packageJsonImport
