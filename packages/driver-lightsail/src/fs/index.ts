import path from 'path'
import { GetObjectCommandOutput, S3, S3ServiceException } from '@aws-sdk/client-s3'
import { VirtualFS } from '@preevy/core'

export const defaultBucketName = (
  { profileAlias, accountId }: { profileAlias?: string; accountId: string },
) => ['preevy', accountId, profileAlias].filter(Boolean).join('-')

const isNotFoundError = (err: unknown) => err instanceof S3ServiceException && err.$metadata.httpStatusCode === 404

const createS3Error = (operation: string, bucket: string, key: string | undefined, originalError: unknown): Error => {
  if (originalError instanceof S3ServiceException) {
    const { $metadata, message, name } = originalError
    const statusCode = $metadata.httpStatusCode
    const location = key ? `s3://${bucket}/${key}` : `s3://${bucket}`

    let errorMessage = `Failed to ${operation} on S3 bucket`

    if (statusCode === 403) {
      errorMessage = `Access denied when trying to ${operation} on Preevy profile S3 bucket. Please check your AWS permissions for the ${operation} operation.`
    } else if (statusCode === 404) {
      errorMessage = `S3 resource not found when trying to ${operation}.`
    } else {
      errorMessage = `S3 operation failed when trying to ${operation}.`
    }

    errorMessage += `\nLocation: ${location}`
    errorMessage += `\nS3 Operation: ${operation}`
    errorMessage += `\nHTTP Status: ${statusCode || 'unknown'}`
    errorMessage += `\nAWS Error: ${name || 'UnknownError'}`
    if (message && message !== name) {
      errorMessage += `\nDetails: ${message}`
    }

    const wrappedError = new Error(errorMessage)
    // Preserve original error properties for debugging
    ;(wrappedError as any).originalError = originalError
    ;(wrappedError as any).statusCode = statusCode
    ;(wrappedError as any).awsErrorName = name

    return wrappedError
  }

  // For non-S3 errors, provide basic context
  const location = key ? `s3://${bucket}/${key}` : `s3://${bucket}`
  const errorMessage = `Failed to ${operation} on Preevy profile S3 bucket.\nLocation: ${location}\nOriginal error: ${originalError}`
  const wrappedError = new Error(errorMessage)
  ;(wrappedError as any).originalError = originalError
  return wrappedError
}

async function ensureBucketExists(s3: S3, bucket: string) {
  try {
    await s3.headBucket({ Bucket: bucket })
    return
  } catch (err) {
    if (!isNotFoundError(err)) {
      throw createS3Error('check bucket permissions (HeadBucket)', bucket, undefined, err)
    }
  }
  try {
    await s3.createBucket({ Bucket: bucket })
  } catch (err) {
    throw createS3Error('create bucket (CreateBucket)', bucket, undefined, err)
  }
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
      const key = path.posix.join(prefix, filename)
      try {
        result = await s3.getObject({
          Bucket: bucket,
          Key: key,
        })
      } catch (err) {
        if (isNotFoundError(err)) {
          return undefined
        }
        throw createS3Error('read file (GetObject)', bucket, key, err)
      }

      const byteArray = await result.Body?.transformToByteArray()
      if (!byteArray) {
        return undefined
      }

      return Buffer.from(byteArray)
    },
    async write(filename: string, content: Buffer | string) {
      const key = path.posix.join(prefix, filename)
      try {
        await s3.putObject({
          Bucket: bucket,
          Key: key,
          Body: content,
        })
      } catch (err) {
        throw createS3Error('write file (PutObject)', bucket, key, err)
      }
    },
    async delete(filename: string) {
      const key = path.posix.join(prefix, filename)
      try {
        await s3.deleteObject({
          Bucket: bucket,
          Key: key,
        })
      } catch (err) {
        if (isNotFoundError(err)) {
          return undefined
        }
        throw createS3Error('delete file (DeleteObject)', bucket, key, err)
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
