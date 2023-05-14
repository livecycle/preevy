export { VirtualFS } from './base'
export { localFs, localFsFromUrl } from './local'
export { jsonReader } from './json-reader'

export const fsTypeFromUrl = (url: string): string => new URL(url).protocol.replace(':', '')
