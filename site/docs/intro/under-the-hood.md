---
sidebar_position: 4
title: Under the hood
---

## Provisioning preview environments

When provisioning a new environment using the [`up`](/cli-reference#preevy-up-service) command, Preevy does the following:

- Load the configuration
  - Read the specified Compose file(s)
  - Read the tunneling key and default flags from the profile.
  - Calculate the environment ID based on the current git branch (or use the `--id` flag.)
  - Connect to the Tunnel Server using the tunneling key to pre-generate the public URLs in env vars
- Make sure a deployment target (VM or Kubernetes Pod) is provisioned:
  - Query the configured cloud provider or Kubernetes cluster for an existing machine
  - If the deployment target doesn't exist yet, a new one is provisioned
- Set up an SSH tunnel to the Docker server on the provisioned deployment target
- Build the Compose project
  - Extract the build information from the specified Compose file(s) and combine it with the specified build options to generate an interim build Compose file.
  - Run `docker buildx bake` with the generated build Compose file.
  - The resulting images are either loaded to the provisioned machine or written to an image registry.
- Deploy the Compose services to the machine's Docker server using the `docker compose up` command
  - Local volume mounts are copied to the remote machine first
  - The original Compose project is augmented with a helper service, `preevy_proxy`, responsible for connecting to the [Tunnel Server](/tunnel-server).
- The `preevy_proxy` service creates a tunnel for each service.
- Fetch the tunneled URLs from the Tunnel Server and print them.

## Profile configuration

The Preevy profile provides a mechanism for storing and sharing configuration and state between different machines. Using a shared profile ensures consistent configuration and stable URLs between different CI runs and different developers.

:::note
The profile does not contain any cloud provider credentials.
:::

### Creating, viewing, editing and deleting a profile

Create a profile using the [`preevy init`](/cli-reference/init) or [`preevy profile create`](/cli-reference/profile#preevy-profile-create-name-url) commands.

Import an existing profile using the [`preevy init --from <profile-url>`](/cli-reference/init) or [`preevy profile import <profile-url> --use`](/cli-reference/profile#preevy-profile-import-location) commands.

View the list of imported profiles using the [`preevy profile ls`](/cli-reference/profile#preevy-profile-ls) command.

Copy a profile between storage locations using the [`preevy profile cp`](/cli-reference/profile#preevy-profile-cp) command.

See the [`preevy profile`](cli-reference/profile) subcommands for other operations on profiles, including viewing the profile contents and editing it.

### Selecting a profile when running Preevy

A profile is identified using a URL. Preevy commands which require a profile accept the `--profile` flag. If the flag is not specified, the default profile is used. The default profile is set to the last created or imported profile, and can be explicitly set using the [`preevy profile use`](/cli-reference/profile#preevy-profile-use-name) command.

### Remote storage for profiles

Preevy includes built-in support for storing profiles remotely on [AWS S3](https://aws.amazon.com/s3/), [Google Cloud Storage](https://cloud.google.com/storage/) and [Azure Blob Storage](https://azure.microsoft.com/en-us/products/storage/blobs/). Storing the profile on remote storage makes it easy share the profile and use Preevy in CI.

#### Required credentials

When using S3, the Preevy CLI uses the local AWS credential chain (e.g, from environment variables, AWS profile, or EC2 role). Similarly, when using Google Cloud Storage or Azure Blob Storage, the Preevy CLI uses the locally stored credentials.

For all remote storage providers, Preevy needs specific permissions to create the bucket (if it doesn't already exist) and read/write objects on the bucket.

#### Remote storage profile URLs

Remote storage profile URLs specify a bucket name and and optional base path. By specifying different base paths, the same bucket can be used to store multiple profiles.

Example AWS S3 URLs:

- `s3://my-bucket?region=us-east-1`: S3 bucket named `my-bucket` in the region `us-east-1`
- `s3://my-bucket/my-path?region=us-east-1`: Same as above, with the base path `my-path`

Example Google Cloud Storage URLs:
- `gs://my-bucket?project=my-project`: GCS bucket named `my-bucket` in the project `my-project`
- `gs://my-bucket/my-path?project=my-project` Same as above, with the base path `my-path`

Example Azure Blob Storage Storage URLs:
- `azblob://my-container?storage_account=myaccount`: AZBlob [container](https://learn.microsoft.com/en-us/azure/storage/blobs/storage-blobs-introduction#containers) named `preevy-config` in the [storage account](https://learn.microsoft.com/en-us/azure/storage/blobs/storage-blobs-introduction#storage-accounts) `my-project`
- `azblob://my-container/my-path?storage_account=myaccount`: Same as above, with the base path `my-path`

### Local storage for profiles 

You can also store the profile on the local filesystem. When using Preevy in CI, a local profile needs to be copied manually in order to create stable URLs between different CI runs.

Example local storage URL:
- `local://profile-name`: A local directory (under the OS's local data dir, e.g, `~/.local/share/preevy`) named `profile-name`

To copy a local profile to remote storage, use the [`preevy profile cp`](/cli-reference/profile#preevy-profile-cp) command.

## Components

#### [CLI](https://github.com/livecycle/preevy/tree/main/packages/cli)

The CLI is a node.js program responsible for:

- Provisioning and tearing down VMs.
- Exposing environments' state and URLs to the end user.
- Storing & accessing profile data. (settings, keys, etc...)
- Setting up a VM with Docker tooling.
- Syncing Compose source code and local volumes.
- Running the application and installing the daemon for connecting to the tunneling service.

For usage examples, you can go over the [CLI reference](/cli-reference)

#### [Tunnel server](https://github.com/livecycle/preevy/tree/main/packages/tunnel-server)

The tunnel server is a Node.js-based server responsible for exposing friendly HTTPS URLs for the Compose services.
A free public instance is hosted on `livecycle.run`, and it can be [self-hosted](https://github.com/livecycle/preevy/tree/main/tunnel-server/deployment/k8s) as well.

Read more about it: [Tunnel server](/tunnel-server)
