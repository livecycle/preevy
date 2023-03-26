---
sidebar_position: 4
title: Under the hood
---
## Provisioning preview environments

When provisioning a new environment using the `preevy up` command the following steps are taken:
- A profile store is read for default configuration and relevant keys.
- If the `--id` flag is not specified, the CLI will try to extract the environment ID from the git branch.
- A new Lightsail VM is created based on the local AWS configuration.
- If necessary, a SSH keypair for accessing the machine is created and stored in the profile.
- `preevy` connects to the VM using SSH and installs Docker.
- `preevy`analyzes the Compose file, copy local volume mounts to the VM and update volume paths.
- `preevy`configure a tunnel-agent that is responsible for connecting to the tunneling service and add it to the Compose deployment.
- `preevy`runs the application using Docker Compose with `--build` while using the local build context.
- The tunnel-agent is inspecting the network configuration of all deployed services and create a tunnel for each service using the configured [tunnel server](/tunnel-server/overview.md).
- `preevy` fetch the urls from tunnel-agent and output them to the end user.
[Add terminal gif]

## Preevy profile configuration

Preevy profile provide a mechanism for storing and sharing configuration and keys between different machines (Multiple developers and/or CI Jobs).

The profile storage consists of multiple tar archives that can be stored locally or in a remote storage provider. (S3 is the only supported implementation at the moment)

:::note
Profile store doesn't contains any cloud provider credentials and when using `preevy` CLI, the user need to have a local cloud
configuration (using `aws login` or `aws configure`, or environment variables).
:::

Each profile has a location, for example: `s3://preevy-config/profile1?region=us-east-1` (refers to a profile stored on S3, on `preevy-config` bucket in the region `us-east-1` under `profile1` path).
This profile can be imported using `preevy init --from s3://preevy-config/profile1?region=us-east-1`

All available profile can be listed using `preevy profile ls` command.

## Components

#### [CLI](packages/cli)

The CLI is a node.js program responsible for:

- Provisioning and tearing down VMs.
- Exposing environments' state and URLs to the end user.
- Storing & accessing profile data. (settings, keys, etc...)
- Setting up a VM with Docker tooling.
- Syncing Compose source code and local volumes.
- Running the application and installing daemon for connecting to the tunneling service.

For usage examples, you can go over the [CLI reference](/cli-reference.md)

#### [Tunnel server](packages/tunnel-server)

The tunnel server is a node.js base server responsible for exposing friendly HTTPS URLs for the Compose services.
A free public instance is hosted on `livecycle.run`, and it can be self-hosted as well.

Read more about it: [Tunnel server](/tunnel-server/overview.md)