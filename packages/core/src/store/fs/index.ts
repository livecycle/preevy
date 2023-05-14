import { localFsFromUrl } from './local'
import { s3fs } from './s3'
import { googleCloudStorageFs } from './google-cloud-storage'

export { VirtualFS } from './base'
export { localFs } from './local'
export { jsonReader } from './json-reader'

export const fsTypeFromUrl = (url: string): string => new URL(url).protocol.replace(':', '')

export const fsFromUrl = async (url: string, localBaseDir: string) => {
  const fsType = fsTypeFromUrl(url)
  if (fsType === 'local') {
    return localFsFromUrl(localBaseDir, url)
  }
  if (fsType === 's3') {
    return s3fs(url)
  }
  if (fsType === 'gs') {
    return googleCloudStorageFs(url)
  }
  throw new Error(`Unsupported URL type: ${fsType}`)
}

export { defaultBucketName as s3DefaultBucketName } from './s3'
export { defaultBucketName as gsDefaultBucketName } from './google-cloud-storage'
