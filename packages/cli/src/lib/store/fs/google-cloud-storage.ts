import { Storage } from '@google-cloud/storage'
import path from 'path'
import stream from 'node:stream'
import { VirtualFS } from './base'

export const defaultBucketName = (
  { profileAlias, project }: { profileAlias: string; project: string },
) => `preevy-${project}-${profileAlias}`

const ensureBucketExists = async (storage: Storage, bucketName: string) => {
  const bucket = storage.bucket(bucketName)
  const [exists] = await bucket.exists()
  if (!exists) {
    await storage.createBucket(bucketName)
  }
  return bucket
}

export const parseUrl = (url: string) => {
  const u = new URL(url)
  if (u.protocol !== 'gs:') {
    throw new Error('Google Cloud Storage urls must start with gs://')
  }
  return {
    url: u,
    bucket: u.hostname,
    path: u.pathname,
    project: u.searchParams.get('project') ?? undefined,
  }
}

const hasErrorCode = (e: unknown, code: unknown) => e && (e as { code: unknown }).code === code

export const googleCloudStorageFs = async (url: string): Promise<VirtualFS> => {
  const u = parseUrl(url)
  const { bucket: bucketName, path: prefix, project } = u

  const storage = new Storage({ projectId: project })
  const bucket = await ensureBucketExists(storage, bucketName)

  return {
    read: async (filename: string) => {
      try {
        const [result] = await bucket.file(path.join(prefix, filename)).download()
        return result
      } catch (error) {
        if (!hasErrorCode(error, 404)) {
          throw error
        }
        return undefined
      }
    },
    write: async (filename: string, content: Buffer | string) => stream.promises.pipeline(
      stream.Readable.from(content),
      bucket.file(path.join(prefix, filename)).createWriteStream(),
    ),
    delete: async (filename: string) => {
      try {
        await bucket.file(filename).delete()
      } catch (error) {
        if (!hasErrorCode(error, 404)) {
          throw error
        }
      }
    },
  }
}
