import { IdempotencyStrategy, Storage } from '@google-cloud/storage'
import path from 'path'
import stream from 'node:stream'
import { GoogleAuth } from 'google-gax'
import { DefaultTransporter } from 'google-auth-library'
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

const authClientWithRetry = () => {
  const transporter = new DefaultTransporter()
  transporter.configure({ retryConfig: { noResponseRetries: 3 } })
  const authClient = new GoogleAuth()
  authClient.transporter = transporter
  return authClient
}

export const googleCloudStorageFs = async (url: string): Promise<VirtualFS> => {
  const { bucket: bucketName, path: prefix, project } = parseUrl(url)

  const storage = new Storage({
    projectId: project,
    authClient: authClientWithRetry(),
    retryOptions: {
      autoRetry: true,
      idempotencyStrategy: IdempotencyStrategy.RetryAlways,
    },
  })
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
