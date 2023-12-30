import lightsail from './driver/index.js'

export default lightsail
export * as awsUtils from './aws-utils/index.js'
export { REGIONS as LIGHTSAIL_REGIONS } from './driver/client.js'
export { s3fs, defaultBucketName, S3_REGIONS } from './fs/index.js'
