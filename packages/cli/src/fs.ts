import { fsTypeFromUrl, localFsFromUrl } from '@preevy/core'
import { googleCloudStorageFs } from '@preevy/driver-gce'
import { s3fs } from '@preevy/driver-lightsail'

export const fsFromUrl = async (url: string, localBaseDir: string) => {
  const fsType = fsTypeFromUrl(url)
  if (fsType === 'local') {
    return localFsFromUrl(localBaseDir, url)
  }
  if (fsType === 's3') {
    // workaround for false positive eslint error on rule @typescript-eslint/return-await on Windows only
    const result = await s3fs(url)
    return result
  }
  if (fsType === 'gs') {
    // workaround for false positive eslint error on rule @typescript-eslint/return-await on Windows only
    const result = await googleCloudStorageFs(url)
    return result
  }
  throw new Error(`Unsupported URL type: ${fsType}`)
}
