import path from 'path'
import fs from 'fs'
import url from 'url'

const __dirname = url.fileURLToPath(new URL('.', import.meta.url))

export const DIR = path.join(__dirname, '../static')

export const readCloudConfig = () => fs.promises.readFile(
  path.join(DIR, 'cloud-config.yaml'),
  { encoding: 'utf8' },
)
