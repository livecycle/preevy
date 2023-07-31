import { fsTypeFromUrl, localFsFromUrl } from '@preevy/core'
import { googleCloudStorageFs } from '@preevy/driver-gce'
import { s3fs } from '@preevy/driver-lightsail'

export const fsFromUrl = async (url: string, localBaseDir: string) => {
  const fsType = fsTypeFromUrl(url)
  if (fsType === 'local') {
    return localFsFromUrl(localBaseDir, url)
  }
  if (fsType === 's3') {
    return await s3fs(url)
  }
  if (fsType === 'gs') {
    return await googleCloudStorageFs(url)
  }
  throw new Error(`Unsupported URL type: ${fsType}`)
}
