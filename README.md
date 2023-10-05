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

> **We recently launched the [Livecycle Docker Extension](https://open.docker.com/extensions/marketplace?extensionId=livecycle/docker-extension). Now you can share local environments instantly. Get feedback while your code is still in flight. Check it out [here](https://open.docker.com/extensions/marketplace?extensionId=livecycle/docker-extension)

https://github.com/Pradumnasaraf/preevy/assets/51878265/a699a356-f524-48fc-9b6d-49f2e42e7ec7

# Preevy

Preevy is a Command Line Interface (CLI) tool designed to simplify the process of creating ephemeral preview environments from Dockerized applications. Integrate Preevy into your CI flow to deploy Pull Requests as preview environments, using your existing cloud provider or Kubernetes cluster.

Preevy makes use of affordable VMs from [AWS Lightsail](https://aws.amazon.com/free/compute/lightsail), [Google Cloud](https://cloud.google.com/compute/), and [Microsoft Azure](https://azure.microsoft.com/en-us/products/virtual-machines), or any [Kubernetes cluster](https://preevy.dev/drivers/kube-pod).

Preevy can deploy your app with public or protected access, on the public internet or inside your existing private network.

Deploying a preview environment per Pull Request offers a range of benefits:

- 🌍 **Universal Access**: Just by sharing a URL, you can allow anyone to try your product revision on any device.

- 📩 **Effortless Asynchronous Updates**: Keep non-technical stakeholders in the loop without coordinating synchronous meetings.

- 🎨 **Hassle-free Design Reviews**: Designers can verify implementation independently, minimizing interruptions.

- 🚀 **Parallel E2E Tests**: Use external test agents against preview environments expedite the testing process.

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
- [Under the hood](#under-the-hood)
  - [CLI](#cli)
  - [Tunnel server](#tunnel-server)
- [CI Integration](#ci-integration)
- [Security](#security)
  - [Notice on preview environments exposure](#notice-on-preview-environments-exposure)
- [Configuration files](#configuration-files)
  - [Preevy-specific configuration](#preevy-specific-configuration)
- [Plugins](#plugins)
- [Docs and support](#docs-and-support)
- [Telemetry](#telemetry)
<!--lint enable double-link-->

## What

Preevy can take any Docker-Compose application definition and with a single `up` command perform the following:

- Provision and configure a new virtual machine (VM) on your cloud.
- Build and deploy your application on the VM.
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

To start using the Preevy CLI you will need:

- Docker for desktop/Docker CLI
- Node 18
- A Docker-Compose application (examples can be found [here](https://github.com/docker/awesome-compose))
- A cloud provider for provisioning VMs (AWS/GCP/Azure), or a Kubernetes cluster (local, remote or managed)

If you don't have an existing cloud account or prefer to try Preevy first locally, you can use the [Docker Desktop Kuberentes server](https://docs.docker.com/desktop/kubernetes/). Go to:
Docker Settings -> Kuberentes -> Enable Kubernetes.
And follow the instructions below.

*For provisioning a VM*, configure your provider:
- In AWS, it could be by using `aws configure`
- In GCP, it could be by using `gcloud auth application-default login`
- In Azure, it could be by using `az login`

*For provisioning a Pod on Kubernetes*, make sure a kubeconfig file exists and that you can run `kubectl` commands locally (e.g, `kubectl get pod`)

Running Preevy:

1. Install the CLI using npm:`npm install -g preevy` , or use it directly using: `npx preevy <command>`
2. Set up a profile by using: `preevy init`
3. Use the `preevy up` command to provision a new VM with your application.
4. Access and share your new preview environment at the `*.livecycle.run` link provided in the command output.
5. Code changed? Re-run `preevy up` to quickly sync the preview environment with your changes on the existing VM.
6. Remove the environment by using: `preevy down`.

## Under the hood

Preevy has two main components:

### [CLI](packages/cli)

The CLI is a Node.js program responsible for:

- Provisioning and tearing down VMs.
- Exposing environments' state and URLs to the end user.
- Storing and accessing profile data (settings, keys, etc).
- Setting up a VM with Docker tooling.
- Syncing Compose source code and local volumes.
- Running the Compose app, augmented with a daemon for connecting to the tunneling service.

### [Tunnel server](packages/tunnel-server)

The tunnel server is a Node.js base server responsible for exposing friendly HTTPS URLs for the Compose services.

A free public instance is hosted on `livecycle.run`, and it can be self-hosted as well.

A Docker/OCI image is available on ghcr.io: ghcr.io/livecycle/preevy/tunnel-server

## CI Integration

Preevy is also designed to work seamlessly with your CI, allowing you to easily import a shared preview profile shared in AWS S3 and Google Cloud Storage (GCS).

Profiles are created using `preevy init`. Choose a S3/GCS URL for storing the profile - Preevy will create a bucket if one doesn't exist.

Once the profile is created, it can be imported to the CI runtime using `preevy init --from <profile-url>`

[Examples](https://preevy.dev/ci/example-github-actions)

## Security

In case you find a security issue or have something you would like to discuss refer to our [security policy](https://github.com/livecycle/preevy/blob/main/security.md).

### Notice on preview environments exposure

Services on provisioned environments are not exposed directly, but rather via a [tunnel](https://livecycle.io/blogs/preevy-proxy-service-2/) created by the tunneling server.

Every Compose service is exposed individually with a generated URL in the following format:
`https://{service}-{[port]}-{env-id}-{client-id}.{tunnel-server-domain}`. If the service exposes a single port, the `port` part is omitted. See [here](https://livecycle.io/blogs/preevy-proxy-service-1/) for a more detailed explanation.

<!--lint disable awesome-list-item-->
- `env-id` can be specified using the `--id` flag of the `preevy up` command, or automatically generated by git context.
- `client-id` is a random identifier based on the profile's public tunneling SSH key (generated in `preevy init`).
- `tunnel-service-domain` is where the tunnel service is hosted. It can be specified using the `--tunnel-url` flag of the `preevy up` command, and defaults to our free service at `*.livecycle.run`.
<!--lint enable awesome-list-item-->

When using the default `*.livecycle.run` domain, environments are publicly accessible to those who know the URLs. You can create private environments by hosting the tunnel service yourself, e.g, on a private network or behind a login page.

## Configuration files

Preevy extracts its runtime settings from the [Compose file](https://docs.docker.com/compose/compose-file/03-compose-file/).

Just like with `docker compose`, you can use the global `--file | -f` option to specify path(s) for the Compose file. If not specified, the [default loading order](https://docs.docker.com/compose/reference/#use--f-to-specify-name-and-path-of-one-or-more-compose-files) is used. Multiple files are [supported](https://docs.docker.com/compose/extends/#multiple-compose-files) just like with `docker compose`.

An additional option `--system-compose-file` can be used to specify paths to Compose files without overriding the default loading order. This is useful for scripts invoking the Preevy CLI (e.g, a GitHub Action), to accept user-provided compose files (including the default loading order) while ensuring a specific file is always loaded.

### Preevy-specific configuration

Additional Preevy-specific configuration, if needed, can be specified by adding a `x-preevy` top-level element to the Compose file(s). Currently only the `plugins` section is supported:

```yaml
services:
  ...
x-preevy:
  plugins:
    ...
```

<!--lint disable double-link-->
See [Plugins](#plugins) below.
<!--lint enable double-link-->

## Plugins

Plugins are a way to extend Preevy's functionality via externally-published NPM packages.

A plugin can execute code in response to events. It can also defined new commands, and add flags to existing commands to customize their behavior.

<!--lint disable double-link-->
Plugins are specified in the [Preevy configuration](#preevy-specific-configuration). Add a `plugins` section to the `x-preevy` top-level element:
<!--lint enable double-link-->

```yaml
services:
  ...
x-preevy:
  plugins:
    - module: '@preevy/plugin-github-pr-link'
      disabled: false # optional, set to true to disable plugin
      # ...additional plugin-specific configuration goes here
```

See the [included GitHub PR Link Plugin](packages/plugin-github-pr-link) for an example.

## Docs and support

Read about Preevy's components and learn how to use them in our [documentation](https://preevy.dev/).

Ask a question or join our [Livecycle Community](https://community.livecycle.io) to get support.

## Telemetry

The Preevy CLI collects telemetry data to help us understand product usage and direct future development.

The data collected is *anonymous* and cannot be used to uniquely identify a user.
Access to the data is limited to Livecycle's employees and not shared with 3rd parties.

We appreciate the usage data sent to us as - it's the most basic and raw type of feedback we get from our users. However, if you are concerned about sending out data, you may choose to disable telemetry.

Telemetry collection can be disabled by setting the environment variable `PREEVY_DISABLE_TELEMETRY` to `1` or `true`.

