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

> We recently launched the [Livecycle Docker Extension](https://hub.docker.com/extensions/livecycle/docker-extension). Now you can share local environments instantly. Get feedback while your code is still in flight. Check it out [here](https://open.docker.com/extensions/marketplace?extensionId=livecycle/docker-extension)

https://github.com/Pradumnasaraf/preevy/assets/51878265/a699a356-f524-48fc-9b6d-49f2e42e7ec7

# Preevy

Preevy is a Command Line Interface (CLI) tool designed to simplify the process of creating ephemeral preview environments from Dockerized applications. Integrate Preevy into your CI flow to deploy Pull Requests as preview environments, using your existing cloud provider or Kubernetes cluster.

Preevy makes use of affordable VMs from [AWS Lightsail](https://aws.amazon.com/free/compute/lightsail), [Google Cloud](https://cloud.google.com/compute/), [Microsoft Azure](https://azure.microsoft.com/en-us/products/virtual-machines), or any [Kubernetes cluster](https://preevy.dev/drivers/kube-pod).

Preevy can deploy your app with public or protected access, on the public internet or inside your existing private network.

Deploying a preview environment per Pull Request offers a range of benefits:

- 🌍 **Universal Access**: Just by sharing a URL, you can allow anyone to try your product revision on any device.

- 📩 **Effortless Asynchronous Updates**: Keep non-technical stakeholders in the loop without coordinating synchronous meetings.

- 🎨 **Hassle-free Design Reviews**: Designers can verify implementation independently, minimizing interruptions.

- 🚀 **Parallel E2E Tests**: Use external test agents against preview environments to expedite the testing process.

- 💡 **Streamlined Feedback Cycle**: Preview environments let your team engage with and feedback on new features early in the pipeline.

- 🧪 **Non-production Experimentation**: Develop and share unique versions of your product for presentations, examples, or tests.

- 🔐 **Secure Collaboration**: Generate private sandboxes to share with external stakeholders, ensuring secure collaborative efforts.

\
Visit The full documentation here: https://preevy.dev/

<!-- omit from toc -->
## Contents

<!--lint disable double-link-->
- [What](#what)
- [Why](#why)
- [Getting started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Install the Preevy CLI](#install-the-preevy-cli)
  - [Set up a profile](#set-up-a-profile)
  - [Deploy your first environment](#deploy-your-first-environment)
  - [Update your environment](#update-your-environment)
  - [List and remove your environment](#list-and-remove-your-environment)
- [Service URLs](#service-urls)
- [Under the hood](#under-the-hood)
  - [CLI](#cli)
  - [Tunnel server](#tunnel-server)
- [CI Integration](#ci-integration)
  - [Faster builds in CI](#faster-builds-in-ci)
  - [Example repos](#example-repos)
- [Security](#security)
  - [Private environments](#private-environments)
  - [Exposure of preview environments](#exposure-of-preview-environments)
  - [Livecycle access to data](#livecycle-access-to-data)
  - [Network isolation](#network-isolation)
- [Configuration](#configuration)
  - [Preevy Profile](#preevy-profile)
  - [Compose files](#compose-files)
  - [`x-preevy`: Preevy-specific configuration in the Compose file(s)](#x-preevy-preevy-specific-configuration-in-the-compose-files)
- [Plugins](#plugins-1)
  - [Default plugins](#default-plugins)
  - [Enabling or disabling plugins](#enabling-or-disabling-plugins)
- [Docs and support](#docs-and-support)
- [Telemetry](#telemetry)
<!--lint enable double-link-->

## What

Preevy can take any [Docker-Compose](https://docs.docker.com/compose/) application definition and with a single `up` command perform the following:

- Provision and configure a virtual machine (VM) on your cloud, or a Pod on your Kubernetes cluster.
- Build your application on the VM/Pod or on any BuildKit builder (optional)
- Deploy your application on the VM/Pod.
- Expose each service of your application to the web with a user-friendly public HTTPS URL without any DNS/Certificate configuration.

These environments can be managed using the Preevy command-line interface (CLI) and can be easily updated or destroyed when necessary.
While Preevy can be used for sharing local environments with your team, its primary goal is to implement preview environments for pull requests. Therefore, it's designed to be easily integrated into CI/CD flows.

## Why

At Livecycle, we believe that preview environments are an integral part of any development flow, in any engineering team.
These non-production, ephemeral environments, created for every Pull Request, can significantly improve PR workflows.
In recent years, preview environments have become increasingly popular, with some PaaS providers even offering deeply integrated preview environments.
However, setting up preview environments can be a complex and costly task, which is why many teams have been hesitant to implement them.
Preevy is designed to simplify this task and provide a framework for provisioning and utilizing preview environments to optimize the PR flow.
You can read more about the story and philosophy behind Preevy [here](https://preevy.dev/intro/motivation).

## Getting started

### Prerequisites

#### Required software

- Node.js [v18 or greater](https://nodejs.org/en/download) on Mac, Linux or Windows.
- Docker CLI with the default Docker Compose and [BuildX](https://github.com/docker/buildx#installing) plug ins. The Docker CLI is included with the [Docker Engine installation](https://docs.docker.com/engine/install/) and can also be [installed separately](https://docs.docker.com/compose/install/).
- To use Kubernetes as a deploy runtime: [kubectl](https://kubernetes.io/docs/tasks/tools/#kubectl).

#### Your Docker Compose app

If you don't have an existing Docker Compose app, check out [Awesome Compose](https://github.com/docker/awesome-compose) - a curated list of Compose samples, from React to Minecraft.

#### Your cloud provider or Kubernetes cluster

<!--lint disable double-link-->
Preevy deploys your app to one of the supported [deploy runtimes](https://preevy.dev/deploy-runtimes/).
<!--lint enable double-link-->

Choose the cloud provider or Kubernetes cluster you're going to use and configure access credentials for it:

- For AWS: use `aws configure`. See [AWS lightsail credentials configurations](https://preevy.dev/deploy-runtimes/aws-lightsail#credentials-configuration).
- For GCP: use `gcloud auth application-default login`. See [GCP credentials configuration](https://preevy.dev/deploy-runtimes/gcp-gce#credentials-configuration)
- For Azure: use `az login`. See [Azure credentials configuration](https://preevy.dev/deploy-runtimes/azure#credentials-configuration)
- For Kubernetes: See [Kubernetes credentials configuration](https://preevy.dev/deploy-runtimes/kube-pod#requirements)

***Note*** Preevy only uses your credentials when you run the Preevy CLI to set up and connect to your environments. Your credentials are not sent or stored anywhere outside of your computer.

##### Local Kubernetes server using Docker Desktop

If you don't have an existing cloud account or prefer to try Preevy first locally, you can use the [Docker Desktop Kubernetes server](https://docs.docker.com/desktop/kubernetes/). Go to: `Docker Settings` -> `Kubernetes` -> `Enable Kubernetes`.

### Install the Preevy CLI

```bash
npm install -g preevy
```

Or use `npx` to run the CLI without installing it:

```bash
npx preevy <command>
```

### Set up a profile

```bash
preevy init
```

Preevy will ask you to select a deploy target and a storage location for your profile. You can start by storing the profile locally.

### Deploy your first environment

From the same directory where your `docker-compose.yml` or `compose.yml` file is located, run the command below:

```bash
preevy up
```

**Note:** Preevy uses the git repo at the current directory to calculate a stable environment ID for your project. Make sure a git repo is initialized (with at least one commit), or add the `--id` flag to explicitly specify the environment ID.

Access and share your new preview environment at the `*.livecycle.run` links provided in the command output.

### Update your environment

Code changed? Re-run `preevy up` to quickly sync the preview environment with your changes on the existing VM or Kubernetes Pod.

### List and remove your environment

Run `preevy ls` to show all environments in your deploy target which are linked to your profile.

Run `preevy down` to remove your environment. Preevy will delete the VM or Kubernetes Pod.

## Service URLs

Every Compose service is exposed individually with a generated URL in the following format:
`https://{service}-{[port]}-{env-id}-{client-id}.{tunnel-server-domain}`. If the service exposes a single port, the `port` part is omitted. See [here](https://livecycle.io/blogs/preevy-proxy-service-1/) for a more detailed explanation.

<!--lint disable awesome-list-item-->
- `env-id` is automatically generated from the Compose project and Git branch, or can be explicitly specified using the `--id` flag of the `preevy up` command.
- `client-id` is a random identifier based on the profile's public tunneling SSH key (generated in `preevy init`).
- `tunnel-service-domain` is where the tunnel service is hosted. It can be specified using the `--tunnel-url` flag of the `preevy up` command, and defaults to Livecycle's hosted service at `*.livecycle.run`.
<!--lint enable awesome-list-item-->

## Under the hood

Preevy has two main components:

### [CLI](https://github.com/livecycle/preevy/tree/main/packages/cli)

The CLI is a Node.js program responsible for:

- Provisioning and tearing down VMs.
- Exposing environments' state and URLs to the end user.
- Storing and accessing profile data (settings, keys, etc).
- Setting up a VM with Docker tooling.
- Syncing Compose source code and local volumes.
- Running the Compose app, augmented with a daemon for connecting to the tunneling service.

### [Tunnel server](https://github.com/livecycle/preevy/tree/main/tunnel-server)

The tunnel server is a Node.js base server responsible for exposing friendly HTTPS URLs for the Compose services.

A free public instance is hosted by Livecycle on `livecycle.run`, and it can be self-hosted as well.

A public Docker/OCI image is available: `ghcr.io/livecycle/preevy/tunnel-server`

## CI Integration

Preevy is designed to work seamlessly with your CI, allowing you to easily import a shared preview profile in AWS S3 and Google Cloud Storage (GCS).

Profiles are created using `preevy init`. Choose a S3/GCS URL for storing the profile - Preevy will create a bucket if one doesn't exist.

If you already have a locally stored Preevy Profile, it can be migrated to remote storage using [`preevy profile cp`](https://github.com/livecycle/preevy/blob/main/packages/cli/docs/profile.md#preevy-profile-cp)

Once the profile is created, it can be imported to the CI runtime using `preevy init --from <profile-url>`

[Examples](https://preevy.dev/ci)

### Faster builds in CI

Check out our [documentation](https://preevy.dev/recipes/faster-build) to find out how to speed up your builds and reduce the costs of your preview environments by running Preevy with BuildKit Builders in CI.

### Example repos

#### GitHub Actions

- [Preevy on Kubernetes using Google Cloud GKE and GAR](https://github.com/livecycle/preevy-gha-gke-demo)
- [Preevy on Google Cloud VMs](https://github.com/livecycle/preevy-gha-gce-demo)

#### Shortcut for setting up a cost-efficient Kubernetes cluster on AWS EKS

Don't have a Kubernetes cluster? See an [example repo](https://github.com/livecycle/preevy-terraform-eks-example) for setting up [AWS EKS](https://docs.aws.amazon.com/eks/latest/userguide/what-is-eks.html) using Terraform. The example includes [Karpenter](https://karpenter.sh/) which can reduce the cost of running Preview Environments by automatically expanding and shrinking your cluster using [EC2 Spot Instances](https://aws.amazon.com/ec2/spot/pricing/)


## Security

In case you find a security issue or have something you would like to discuss, refer to our [security policy](https://github.com/livecycle/preevy/blob/main/security.md#reporting-security-issues).

### Private environments

Preevy can add an authentication layer to your provisioned environments. When you configure your service as [private](https://preevy.dev/recipes/private-services/) the Tunnel Server restricts access based on a pre-shared secret or a Livecycle login (SSO via Google/Microsoft/GitHub).

### Exposure of preview environments

Services on provisioned environments are not exposed directly, but rather via a [tunnel](https://livecycle.io/blogs/preevy-proxy-service-2/) created by the tunneling server.

### Livecycle access to data

When you use Preevy, Livecycle does not get access to your credentials or code. Preevy only uses your cloud provider or Kubernetes credentials to provision and connect to environments - it does not send or store the credentials.

Encrypted traffic to and from your environments goes through Preevy's [Tunnel Server](https://preevy.dev/tunnel-server). Livecycle hosts the default Tunnel Server at livecycle.run which is available as part of Livecycle's SaaS offering. Like most SaaS providers, we keep logs for monitoring and troubleshooting purposes which include metadata of the requests. The Tunnel Server code is part of the Preevy OSS project; you can run it on your own infrastructure and specify the its address via the `--tunnel-url` flag.

### Network isolation

The Tunnel Server can be deployed on your private network (e.g. VPC), which access to your environments at the network level.

## Configuration

Preevy loads its configuration from the following sources, in order:

<!--lint disable double-link-->
- The Preevy Profile
- Compose files ([Preevy-specific](#preevy-specific-compose-file), then [project](#project-compose-files))
- Command-line arguments
<!--lint enable double-link-->

### Preevy Profile

The Preevy profile is created by the `init` command and can be stored locally or remotely on your cloud provider. A profile is required to create environments. The profile includes the following:

<!--lint disable double-link-->
- A tunneling key, that is used to identify your services when connecting to the [Tunnel Server](#tunnel-server).
- The default driver to use for provisioning environments.
- Default driver options to use per driver (e.g. AWS region, K8s namespace).
- Driver state whose contents depend on the specific driver.
<!--lint enable double-link-->

Profiles can be migrated to a different storage location using `preevy profile cp`.

The `default` profile can be overridden using the global command line argument `--profile`.

<sub><sup>Note: The profile currently combines context and state, and [some changes are planned](https://github.com/livecycle/preevy/issues/329).</sup></sub>

### Compose files

Preevy extracts its runtime settings from the [Compose file](https://docs.docker.com/compose/compose-file/03-compose-file/).

#### Project Compose files

Just like with the `docker compose` CLI, you can use the global `--file | -f` command line argument to specify the path(s) for the Compose file. If not specified, the [default loading order](https://docs.docker.com/compose/reference/#use--f-to-specify-name-and-path-of-one-or-more-compose-files) is used. Multiple files are [supported](https://docs.docker.com/compose/extends/#multiple-compose-files).

#### Preevy-specific Compose file

In addition to the project compose files, an optional Preevy-specific Compose file can be used. Preevy attempts to load files named `compose.preevy.yaml`, `compose.preevy.yml`, `docker-compose.preevy.yaml` or `docker-compose.preevy.yml`. If one of these exists, it is loaded BEFORE the project composes file(s). The name of the Preevy-specific compose file can be overridden by specifying the argument `--system-compose-file`.

### `x-preevy`: Preevy-specific configuration in the Compose file(s)

A `x-preevy` top-level element can be added to the Compose file(s).

```yaml
services:
  ...
x-preevy:
  driver: lightsail
  drivers:
    lightsail:
      region: eu-central-1
    kube-pod:
      context: dev-cluster
  plugins:
    ...
```

The following properties are supported, all of them optional:

#### `driver`

<!--lint disable double-link-->
Override the default [driver](https://preevy.dev/deploy-runtimes/) to use for this Compose project.
Available values: `lightsail`, `gce`, `azure`, `kube-pod`.
<!--lint enable double-link-->

This value can be overridden per command execution using the `--driver` CLI flag.

#### `drivers`

<!--lint disable double-link-->
Override the default options per driver for this Compose project. See the [specific driver documentation](https://preevy.dev/deploy-runtimes/).
<!--lint enable double-link-->

These values can be overridden per command execution using the specific driver CLI flags, e.g. `--lightsail-bundle-id=2xlarge_2_0`

Example:

```yaml
x-preevy:
  drivers:
    lightsail:
      bundle-id: large_2_0
    kube-pod:
      context: dev-cluster
```

#### `plugins`

<!--lint disable double-link-->
See [Plugins](#plugins) below.
<!--lint enable double-link-->

## Plugins

Plugins are a way to extend Preevy's functionality via externally-published NPM packages.

A plugin can add hooks that execute code in response to events. It can also define new commands, and add flags to existing commands to customize their behavior.

### Default plugins

The [GitHub integration plugin](packages/plugin-github) packaged as `@preevy/plugin-github` is bundled with Preevy and enabled by default.

### Enabling or disabling plugins

#### From the Docker Compose file

<!--lint disable double-link-->
Plugins can be configured in the [Preevy configuration](#x-preevy-preevy-specific-configuration-in-the-compose-files) section of your Compose file. Add a `plugins` section to the `x-preevy` top-level element:
<!--lint enable double-link-->

```yaml
services:
  ...
x-preevy:
  plugins:
    - module: '@preevy/plugin-github'
      disabled: false # optional, set to true to disable plugin
      # ...additional plugin-specific configuration goes here
```

See the [included GitHub integration plugin](packages/plugin-github/README.md) for a detailed example.

#### From the environment

Plugins can be enabled or disabled by setting the `PREEVY_ENABLE_PLUGINS` and `PREEVY_DISABLE_PLUGINS` environment variables to a comma-separated list of packages.

Example: To disable the default GitHub integration plugin, set `PREEVY_DISABLE_PLUGINS=@preevy/plugin-github`.

#### From the CLI flags

Specify the global `--enable-plugin=<module>` and `--disable-plugin=<module>` flags to enable or disable plugins per command execution. CLI flags take priority over the Docker Compose and environment configuration.

## Docs and support

Read about Preevy's components and learn how to use them in our [documentation](https://preevy.dev/).

Ask a question or join our [Livecycle Community](https://community.livecycle.io) to get support.

## Telemetry

The Preevy CLI collects telemetry data to help us understand product usage and direct future development.

The data collected is *anonymous* and cannot be used to uniquely identify a user.
Access to the data is limited to Livecycle's employees and not shared with 3rd parties.

To see the collected data, set the environment variable `PREEVY_TELEMETRY_FILE` to a filename.

We appreciate the usage data sent to us as - it's the most basic and raw type of feedback we get from our users. However, if you are concerned about sending out data, you may choose to disable telemetry.

Telemetry collection can be disabled by setting the environment variable `PREEVY_DISABLE_TELEMETRY` to `1` or `true`.
