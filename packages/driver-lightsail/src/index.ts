import lightsail from './driver'

export default lightsail
export * as awsUtils from './aws-utils'
export { REGIONS as LIGHTSAIL_REGIONS } from './driver/client'
export { s3fs, defaultBucketName, S3_REGIONS } from './fs'
