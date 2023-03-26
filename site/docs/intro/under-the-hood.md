---
sidebar_position: 4
title: Under the hood
---
## Provisioning preview environments

When provisioning a new environment using the `up` command, `preevy` does the following:
- Reads for default configuration and relevant keys from the current profile store.
- Calculates environment name based on git branch or uses the `--id` flag.
- Uses the local aws configuration to provision a new Lightsail VM.
- Reads SSH keypair from profile to access the VM, if necessary, generate a new one.
- Connects to the VM using SSH and setup Docker.
- Reads the compose file and copies local volume mounts to the VM.
- Augments the compose deployment with a helper service, `tunnel-agent`, responsible for connecting to the [tunnel server](/tunnel-server/overview.md).
- Runs the application using Docker Compose with `--build` while using the local build context.
- The `tunnel-agent` is inspecting the network configuration of all deployed services and create a tunnel for each service.
- Fetch the urls from tunnel-agent and output them to the end user.

## Profile configuration

`preevy` profile provide a mechanism for storing and sharing configuration and state between different machines. This allows sharing of environments between different CI jobs, or different developers.
Using a shared profile ensure consistent configuration and stable URLs between different CI runs.

The profile data can be stored on AWS s3 for easy sharing. If for some reason s3 cannot be used, the profile can also be stored on the local filesystem and copied manually.

:::note
Profile store doesn't contain any cloud provider credentials.  
The `preevy` CLI always uses the local AWS credential chain (e.g, from environment variables, AWS profile, EC2 role), which needs to have the appropriate permissions.
:::

Each profile has a location specifier that indicate where the profile data is stored, for example: `s3://preevy-config/profile1?region=us-east-1` (refers to a profile stored on S3, on `preevy-config` bucket in the region `us-east-1` under `profile1` path).

This profile can be imported using `preevy init --from s3://preevy-config/profile1?region=us-east-1`
All available profiles can be listed using `preevy profile ls` command.

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

The tunnel server is a node.js based server responsible for exposing friendly HTTPS URLs for the Compose services.
A free public instance is hosted on `livecycle.run`, and it can be self-hosted as well.

Read more about it: [Tunnel server](/tunnel-server/overview.md)