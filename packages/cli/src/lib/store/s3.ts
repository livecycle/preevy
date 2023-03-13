import { CreateBucketCommand, DeleteObjectCommand, GetObjectCommand, GetObjectCommandOutput, HeadBucketCommand, PutObjectCommand, S3Client, S3ServiceException } from '@aws-sdk/client-s3'
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts'
import path from 'path'
import { VirtualFS } from './types'

export async function suggestDefaultUrl(profileAlias: string) {
  const sts = new STSClient({})
  const { Account: AccountId } = await sts.send(new GetCallerIdentityCommand({}))
  return `s3://preview-${AccountId}-${profileAlias}?region=us-east-1`
}

async function ensureBucketExists(s3: S3Client, bucket: string) {
  try {
    await s3.send(new HeadBucketCommand({
      Bucket: bucket,
    }))
    return
  } catch (err) {
    if (err instanceof S3ServiceException) {
      if (err.$metadata.httpStatusCode !== 404) {
        throw err
      }
    }
  }
  try {
    await s3.send(new CreateBucketCommand({
      Bucket: bucket,
    }))
    return
  } catch (err) {
    if (err instanceof S3ServiceException) {
      if (err.$metadata.httpStatusCode !== 409) {
        throw err
      }
    }
  }
}

export type S3Url = {
  region: string
  bucket: string
  path: string
}

export function parseS3Url(s3Url: string) {
  const url = new URL(s3Url)
  if (url.protocol !== 's3:') {
    throw new Error('s3 urls must start with s3://')
  }
  const region = url.searchParams.get('region')
  if (!region) {
    throw new Error('s3 urls must have a region query parameter')
  }
  return {
    url: s3Url,
    region,
    bucket: url.hostname,
    path: url.pathname,
  }
}

export const s3fs = async (s3Url: string):Promise<VirtualFS> => {
  const url = parseS3Url(s3Url)
  const { bucket, path: prefix } = url
  const s3 = new S3Client({
    region: url.region,
  })

  await ensureBucketExists(s3, bucket)

  return {
    // TODO: add cache using if-match header
    async read(filename: string) {
      let result: GetObjectCommandOutput
      try {
        result = await s3.send(new GetObjectCommand({
          Bucket: bucket,
          Key: path.join(prefix, filename),
        }))
      } catch (error) {
        if (error instanceof S3ServiceException) {
          if (error.$metadata.httpStatusCode === 404) {
            return undefined
          }
        }
        throw error
      }

      const byteArray = await result.Body?.transformToByteArray()
      if (!byteArray) {
        return undefined
      }

      return Buffer.from(byteArray)
    },
    async write(filename: string, content: Buffer | string) {
      await s3.send(new PutObjectCommand({
        Bucket: bucket,
        Key: path.join(prefix, filename),
        Body: content,
      }))
    },
    async delete(filename: string) {
      await s3.send(new DeleteObjectCommand({
        Bucket: bucket,
        Key: path.join(prefix, filename),
      }))
    },
  }
}
