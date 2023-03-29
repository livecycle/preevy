---
sidebar_position: 3
title: Under the hood
---

## Provisioning preview environments

When provisioning a new environment using the [`up`](/cli-reference#preevy-up-service) command, `preevy` does the following:

- Reads for [default configurations](#profile-configuration) and relevant keys from the current profile store.
- Calculates environment name based on the current git branch (or uses the `--id` flag.)
- Uses the local AWS configuration to provision a new Lightsail VM.
- Reads SSH keypair from profile to access the VM, if necessary, generate a new one.
- Connects to the VM using SSH and sets up Docker.
- Reads the compose file and copies local volume mounts to the VM.
- Augments the compose deployment with a helper service, `tunnel-agent`, responsible for connecting to the [tunnel server](/tunnel-server).
- Runs the application using [docker-compose](https://docs.docker.com/compose/) with `--build` while using the local build context.
- The `tunnel-agent` is inspecting the network configuration of all deployed services and create a tunnel for each service.
- Fetch the urls from tunnel-agent and output them to the end user.

## Profile configuration

You can use a `preevy` profile to store and share configuration and state between different machines. It's recommended to use profiles to share environments between different CI jobs, or different developers.
Using a shared profile ensures consistent configuration, and stable URLs between different CI runs.

To make it easy to share, a `preevy` profile can be stored on (AWS S3)[https://aws.amazon.com/s3/]. If you can't use S3, you can store the profile on the local filesystem and copy it manually.

:::note
The profile store doesn't contain any cloud provider credentials.
The `preevy` CLI always uses the local AWS credential chain (e.g, from environment variables, AWS profile, EC2 role). The credentials used need to have the [appropriate permissions](/drivers/aws-lightsail).
:::

Profile URLs specify where the profile data is stored. For example: `s3://preevy-config/profile1?region=us-east-1` refers to a profile stored on a S3 bucket named `preevy-config` in the region `us-east-1` under `profile1` path.
This profile can be imported using `preevy init --from s3://preevy-config/profile1?region=us-east-1`.

All `preevy` profile listing and management commands are listed in the [CLI reference page](/cli-reference#preevy-profile-create-name-url). 

## `preevy` components

#### [CLI](https://github.com/livecycle/preevy/tree/main/packages/cli)

The CLI is a node.js program responsible for:

- Provisioning and tearing down VMs.
- Exposing environments' state and URLs to the end user.
- Storing & accessing profile data. (settings, keys, etc...)
- Setting up a VM with Docker tooling.
- Syncing Compose source code and local volumes.
- Running the application and installing daemon for connecting to the tunneling service.

For usage examples, review the [CLI reference](/cli-reference.md)

#### [Tunnel server](https://github.com/livecycle/preevy/tree/main/packages/tunnel-server)

The tunnel server is a node.js based server responsible for exposing friendly HTTPS URLs for the Compose services.
A free public instance is hosted on `livecycle.run`, and it can be self-hosted as well.

Read more about it: [Tunnel server](/tunnel-server)
