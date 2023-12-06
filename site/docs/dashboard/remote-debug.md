---
sidebar_position: 3
title: Remote Debugging
---

## Provisioning preview environments

When provisioning a new environment using the [`up`](/cli-reference#preevy-up-service) command, Preevy does the following:

- Load the configuration
  - Read the specified Compose file(s)
  - Read the tunneling key and default flags from the profile.
  - Calculate the environment ID based on the current git branch (or uses the `--id` flag.)
  - Connect to the Tunnel Server using the tunneling key to pre-generate the public URLs in env vars
- Make sure a machine is provisioned:
  - Query the configured cloud provider for an existing machine
  - If a machine doesn't exist yet, a new one is provisioned and a Docker server is set up in it
- Set up a SSH tunnel to the Docker server on the provisioned machine
- Build the Compose project
  - Extract the build information from the specified Compose file(s) and combine it with the specified build options to generates an interim build Compose file.
  - Run `docker buildx bake` with the generated build Compose file.
    - The resulting images are either loaded to the provisioned machine or written to an image registry.
- Deploy the Compose services to the machine's Docker server using the `docker compose up` command
  - Local volumes mounts are copied to the remote machine firsst
  - The original Compose project with is augmented with a helper service, `preevy_proxy`, responsible for connecting to the [Tunnel Server](/tunnel-server).
- The `preevy_proxy` service creates a tunnel for each service.
- Fetch the urls from Tunnel Server and output them.

## Profile configuration

The Preevy profile provides a mechanism for storing and sharing configuration and state between different machines. This allows sharing of environments between different CI jobs, or different developers.
Using a shared profile ensures consistent configuration and stable URLs between different CI runs.

Preevy includes built-in support for sharing profiles using [AWS S3](https://aws.amazon.com/s3/) and [Google Cloud Storage](https://cloud.google.com/storage/). You can also store the profile on the local filesystem and copy it manually.

:::note
The profile does not contain any cloud provider credentials.

When using S3, the Preevy CLI uses the local AWS credential chain (e.g, from environment variables, AWS profile, or EC2 role)

Similarly, when using Google Cloud Storage, the Preevy CLI uses the locally stored Google Cloud credentials.

For both providers, Preevy needs specific permissions to create the bucket (if it doesn't already exist) and read/write objects on the bucket.

### Profile URLs

Profile URLs specify the location of the shared profile on AWS S3 or Google Cloud Storage. A bucket name is always specified. The same bucket can be used to store multiple profiles by specifying a base path.

Example AWS S3 URL:
```
s3://preevy-config/profile1?region=us-east-1
```

Refers to a profile stored on a S3 bucket named `preevy-config` in the region `us-east-1` under the base path `profile1`.

Example Google Cloud Storage URL:

```
gs://preevy-config/profile1?project=my-project
```

Refers to a profile stored on a GCS bucket named `preevy-config` in the project `my-project` under the base path `profile1`.

To import a shared profile, specify its URL to the `preevy init` command:

```
preevy init --from s3://preevy-config/profile1?region=us-east-1
```

List profiles which were already imported using the command [`preevy profile ls`](/cli-reference#preevy-profile-ls).

## Components

#### [CLI](https://github.com/livecycle/preevy/tree/main/packages/cli)

The CLI is a node.js program responsible for:

- Provisioning and tearing down VMs.
- Exposing environments' state and URLs to the end user.
- Storing & accessing profile data. (settings, keys, etc...)
- Setting up a VM with Docker tooling.
- Syncing Compose source code and local volumes.
- Running the application and installing daemon for connecting to the tunneling service.

For usage examples, you can go over the [CLI reference](/cli-reference)

#### [Tunnel server](https://github.com/livecycle/preevy/tree/main/packages/tunnel-server)

The tunnel server is a node.js based server responsible for exposing friendly HTTPS URLs for the Compose services.
A free public instance is hosted on `livecycle.run`, and it can be self-hosted as well.

Read more about it: [Tunnel server](/tunnel-server)
