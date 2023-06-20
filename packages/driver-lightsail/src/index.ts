import lightsail from './driver'

export default lightsail
export * as awsUtils from './aws-utils'
export { REGIONS as AWS_REGIONS } from './driver/client'
export { s3fs, defaultBucketName } from './fs'
