---
sidebar_position: 1
title: AWS Lightsail Driver
---

# AWS Lightsail Driver

Preevy can provision virtual machines on AWS Lightsail using the `aws-lightsail` driver.
[AWS lightsail](https://aws.amazon.com/lightsail) is Amazon's cost-effective solution for VMs in the cloud.
AWS lightsail provisioning time for a VM is usually around 2 minutes, and its cost can be as low as $3.50 per month making them suitable for preview environments at scale.


### Supported flags
- `--aws-region` - The AWS region to use.

### Credentials Configuration
Preevy uses the AWS JS SDK which supports multiple ways of configuring credentials, according to the [credentials provider chain](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/setting-credentials-node.html).
The simplest way is to use `aws configure` command or to set the `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` environment variables.

In GitHub Actions, you can also use the [aws-actions/configure-aws-credentials](https://github.com/aws-actions/configure-aws-credentials) action to setup credentials in a secure way.

Also, you can check out the video below for a step-by-step guide on how to configure AWS credentials and use them with Preevy.

<p align="center"><iframe width="816" height="480" src="https://www.youtube.com/embed/LXOHlK5T7Ew?si=wPZlEi4mugQYL8GI" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></p>

### Required AWS permissions

Preevy requires the following IAM policy to be able to provision and manage Lightsail VMs:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "lightsail:*",
      "Resource": "*"
    }
  ]
}

```

:::note
When defining fine-grained permissions for Preevy, make sure to add S3 permissions as well when using s3 as profile store.
We recommend scoping the permissions to a specific bucket and prefix:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket",
        "s3:GetBucketLocation",
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:CreateBucket"
      ],
      "Resource": ["arn:aws:s3:::MY_BUCKET", "arn:aws:s3:::MY_BUCKET/*"]
    }
  ]
}

```
:::
