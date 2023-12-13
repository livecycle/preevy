import path from 'path'

const DIR = path.join(import.meta.url, '../static')
export const DEFAULT_TEMPLATE = path.join(DIR, './default-template.yaml.njk')
export const PACKAGE_JSON = path.join(import.meta.url, '..', 'package.json')
