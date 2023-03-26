---
sidebar_position: 1
title: AWS Lightsail
---

`preevy` can provision virtual machines on AWS Lightsail using the `aws-lightsail` driver.  
[AWS lightsail](https://aws.amazon.com/lightsail) is a managed service that provides a simple low-cost solution for running VMs in the cloud.  
AWS lightsail provisioning time for a VM is usually around 2 minutes and their cost can be as low as $3.50 per month making them suitable for preview environments at scale.

### Credentials Configuration
`preevy` uses AWS SDK which supports multiple ways of configuring credentials  according to the [credentials provider chain](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/setting-credentials-node.html).  
The simplest way is to use `aws configure` command or setting the `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` environment variables.

In Github actions, you can also use the [aws-actions/configure-aws-credentials](https://github.com/aws-actions/configure-aws-credentials) action to setup credentials in a secure way.

### Required permissions

`preevy` requires the following policy to be able to provision and manage Lightsail VMs:
```
{
 "Version": "2012-10-17",
 "Statement": [
 {
 "Effect": "Allow",
 "Action": [
 "lightsail:*"
 ],
 "Resource": "*"
 }
 ]
}
```

For using AWS s3 remote storage for profile store, s3 permissions are required as well (can be scoped to a specific bucket):
```
{
 "Version": "2012-10-17",
 "Statement": [
 {
  "Effect": "Allow",
  "Action": [
    "s3:HeadBucker",
    "s3:GetBucketLocation",
    "s3:ListObjects",
    "s3:ListObjectsV2",
    "s3:PutObject",
    "s3:GetObject",
    "s3:PutObjectTagging",
    "s3:DeleteObjectTagging",
    "s3:DeleteObject",
    "s3:CreateBucket", //only if bucket doesn't exist
  ],
  "Resource": [
    "arn:aws:s3:::MY_BUCKET",
    "arn:aws:s3:::MY_BUCKET/*"
  ]
 }
 ]
}
```

### Supported flags
- `--aws-region` - The AWS region to use.

