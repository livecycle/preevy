export { VirtualFS } from './base.js'
export { localFs, localFsFromUrl } from './local.js'
export { jsonReader } from './json-reader.js'

export const fsTypeFromUrl = (url: string): string => new URL(url).protocol.replace(':', '')
