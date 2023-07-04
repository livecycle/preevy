import path from 'path'

const DIR = path.join(__dirname, '../static')
export const DEFAULT_TEMPLATE = path.join(DIR, './default-template.yaml.njk')
export const PACKAGE_JSON = path.join(__dirname, '..', 'package.json')
