<h1 align="center">
  <a href="https://preevy.dev" target="_blank" rel="noopener noreferrer">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="site/static/img/logo-dark.svg">
      <img width="80" src="site/static/img/logo-light.svg">
    </picture>
  </a>
  <br />
  Preevy
</h1>
<p align="center"> <em>Provision preview environments with minimal configuration</em> <span>&#8226;</span>
 <b>made by <a href="https://livecycle.io/">Livecycle</a></b>
</p>
<div align="center">

![GitHub](https://img.shields.io/github/license/livecycle/preevy) ![GitHub last commit](https://img.shields.io/github/last-commit/livecycle/preevy) [![Version](https://img.shields.io/npm/v/preevy.svg)](https://npmjs.org/package/preevy)

</div>

<br />

![Terminal GIF](./terminal.gif)

Preevy is a powerful CLI tool designed to simplify the process of creating ephemeral preview environments.
Using Preevy, you can easily provision any Docker-Compose application on AWS using affordable [Lightsail](https://aws.amazon.com/free/compute/lightsail) VMs or simple Google cloud VMS (support more cloud providers is on the way).

## Documentation

Visit The full documentation here: https://preevy.dev/

## What?

Preevy can take any Docker-Compose application definition and with a single `up` command perform the following:

- Provision and configure a new virtual machine (VM) on your cloud.
- Build and deploy your application on the VM.
- Expose each service of your application to the web with a user-friendly public HTTPS URL without any DNS/Certificate configuration.

These environments can be managed using the Preevy command-line interface (CLI) and can be easily updated or destroyed when necessary.
While Preevy can be used for sharing local environments with your team, its primary goal is to implement preview environments for pull requests. Therefore, it's designed to be easily integrated into CI/CD flows.

## Why?

At Livecycle, we believe that preview environments are an integral part of any development flow, in any engineering team.
These non-production, ephemeral environments, created for every Pull Request, can significantly improve PR workflows.
In recent years, preview environments have become increasingly popular, with some PaaS providers even offering deeply integrated preview environments.
However, setting up preview environments can be a complex and costly task, which is why many teams have been hesitant to implement them.
Preevy is designed to simplify this task and provide a framework for provisioning and utilizing preview environments to optimize the PR flow.
You can read more about the story and philosophy behind Preevy [here](https://preevy.dev/intro/motivation).

## Getting started

To start using the Preevy CLI you will need:

- A local Cloud provider configuration context:
  - In AWS, it could be by using `aws login` or `aws configure`
  - In GCP, it could be by using `gcloud auth application-default login`
- A Docker-Compose application (examples can be found [here](https://github.com/docker/awesome-compose))

Running Preevy:

1. Install the CLI using npm:`npm install -g preevy` , or use it directly using: `npx preevy <command>`
2. Set up a profile by using: `preevy init`
3. Use `up` command to provision a new VM with your application: `preevy up`
4. Access and share your new preview environment by using the `*.livecycle.run` outputted by the CLI.
5. Code changed? Re-run `up` to quickly sync the preview environment with your changes on the existing VM.
6. Destroy the environment by using: `preevy down`.

## Under the hood

Preevy has two main components:

#### [CLI](packages/cli)

The CLI is a node.js program responsible for:

- Provisioning and tearing down VMs.
- Exposing environments' state and URLs to the end user.
- Storing & accessing profile data. (settings, keys, etc...)
- Setting up a VM with Docker tooling.
- Syncing Compose source code and local volumes.
- Running the application and installing daemon for connecting to the tunneling service.

#### [Tunnel server](packages/tunnel-server)

The tunnel server is a node.js base server responsible for exposing friendly HTTPS URLs for the Compose services.
A free public instance is hosted on `livecycle.run`, and it can be self-hosted as well.

A Docker/OCI image is available on ghcr.io: ghcr.io/livecycle/preevy/tunnel-server

## CI Integration

Preevy is also designed to work seamlessly with your CI, allowing you to easily import a shared preview profile shared in S3. Support for more storage providers is coming soon.

The profile can be created using `preevy init`, then choosing a S3 URL for storing the profile. Preevy will create a bucket if one doesn't exist.

After the profile is created, it can be imported to the CI runtime using `preevy init --from <s3-url>`

[Examples]

## Security

In case you find a security issue or have something you would like to discuss refer to our security.md policy.

#### Notice on preview environments exposure

VMs are not exposed directly and instead are exposed via a tunnel created by the tunneling server.
Every Compose service is exposed individually with a generated URL in the following format:
`https://{service}-{[port]}-{envId}-{clientId}.{tunnel-server domain}`

- EnvId can be specified by the `up` command `id` flag, or automatically generated by git context.
- ClientId is a unique identifier based on the profile's public tunneling SSH key (generated in `init`).
  When using the `*.livecycle.run`, all environments are publicly accessible to those who know of the URLs.

## Docs and support

Read about Preevy's components and learn how to use them in our [documentation](https://preevy.dev/).

Ask a question or join our [Slack community](https://join.slack.com/t/preevyusers/shared_invite/zt-1shi7t2dy-~glGUC5pWCtGrH19bKNXrQ) to get support.

## Telemetry

The Preevy CLI collects telemetry data to help us understand product usage and direct future development.

The data collected is *anonymous* and cannot be used to uniquely identify a user.
Access to the data is limited to Livecycle's employees and not shared with 3rd parties.

We appreciate the usage data sent to us as - it's the most basic and raw type of feedback we get from our users. However, if you are concerned about sending out data, you may choose to disable telemetry.

Telemetry collection by can be disabled by setting the environment variable PREEVY_DISABLE_TELEMETRY to "1" or "true".

## Contributing

Found a bug? Have a missing feature? Please open an issue to let us know.
