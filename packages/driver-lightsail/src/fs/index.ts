import path from 'path'
import { GetObjectCommandOutput, S3, S3ServiceException } from '@aws-sdk/client-s3'
import { VirtualFS } from '@preevy/core'

export const defaultBucketName = (
  { profileAlias, accountId }: { profileAlias: string; accountId: string },
) => `preevy-${accountId}-${profileAlias}`

const isNotFoundError = (err: unknown) => err instanceof S3ServiceException && err.$metadata.httpStatusCode === 404

async function ensureBucketExists(s3: S3, bucket: string) {
  try {
    await s3.headBucket({ Bucket: bucket })
    return
  } catch (err) {
    if (!isNotFoundError(err)) {
      throw err
    }
  }
  await s3.createBucket({ Bucket: bucket })
}

function parseS3Url(s3Url: string) {
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

export const s3fs = async (s3Url: string): Promise<VirtualFS> => {
  const url = parseS3Url(s3Url)
  const { bucket, path: prefix } = url
  const s3 = new S3({
    region: url.region,
  })

  await ensureBucketExists(s3, bucket)

  return {
    // TODO: add cache using if-match header
    async read(filename: string) {
      let result: GetObjectCommandOutput
      try {
        result = await s3.getObject({
          Bucket: bucket,
          Key: path.posix.join(prefix, filename),
        })
      } catch (err) {
        if (isNotFoundError(err)) {
          return undefined
        }
        throw err
      }

      const byteArray = await result.Body?.transformToByteArray()
      if (!byteArray) {
        return undefined
      }

      return Buffer.from(byteArray)
    },
    async write(filename: string, content: Buffer | string) {
      await s3.putObject({
        Bucket: bucket,
        Key: path.posix.join(prefix, filename),
        Body: content,
      })
    },
    async delete(filename: string) {
      try {
        await s3.deleteObject({
          Bucket: bucket,
          Key: path.posix.join(prefix, filename),
        })
      } catch (err) {
        if (isNotFoundError(err)) {
          return undefined
        }
        throw err
      }
      return undefined
    },
  }
}

export const S3_REGIONS = [
  'us-east-2',
  'us-east-1',
  'us-west-1',
  'us-west-2',
  'af-south-1',
  'ap-east-1',
  'ap-south-2',
  'ap-southeast-3',
  'ap-southeast-4',
  'ap-south-1',
  'ap-northeast-3',
  'ap-northeast-2',
  'ap-southeast-1',
  'ap-southeast-2',
  'ap-northeast-1',
  'ca-central-1',
  'cn-north-1',
  'cn-northwest-1',
  'eu-central-1',
  'eu-west-1',
  'eu-west-2',
  'eu-south-1',
  'eu-west-3',
  'eu-north-1',
  'eu-south-2',
  'eu-central-2',
  'me-south-1',
  'me-central-1',
  'il-central-1',
  'sa-east-1',
  'us-gov-east-1',
  'us-gov-west-1',
]
