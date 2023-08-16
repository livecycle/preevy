import path from 'path'
import fs from 'fs'

const DIR = path.join(__dirname, '../static')

export const readCloudConfig = () => fs.promises.readFile(
  path.join(DIR, 'cloud-config.yaml'),
  { encoding: 'utf8' },
)
