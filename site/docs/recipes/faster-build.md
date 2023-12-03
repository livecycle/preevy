---
title: Faster builds
sidebar_position: 2
---

## tl;dr

To build faster in your CI:

- Create and use BuildKit builders to offload resource-intensive builds. Specify the `--builder` flag to use the created BuildKit builders.
- Specify the `--registry` flag to automatically add caching to your Compose build model.
- For fine-tuned optimization, create a Compose file for your CI to override the build parameters.

## Problem

By default, Preevy runs the build in the Docker server of the remote machine that Preevy provisions. Builds are often more resource intensive than the environment runtime - but those resources are only required when the environment is created or updated.

In addition, builds often run with no cache (especially when the machine was just created, e.g, a new PR on a new branch) taking longer than they should. Configuring a remote cache manually is possible, but requires some work.

## Solutions

1. Offloading the build step to a specialized server can reduce the memory, disk and CPU requirements of the machines provisioned for environments. It can also help speed up the build step so Preview Environments can be created faster in your CI.
2. Reusing cached layers from previous builds can accelerate the build by skipping expensive build steps (e.g, `yarn install`). When creating Preview Environments In CI, cached image layers from the base branch, or previous builds of the same branch can be reused.

Starting with version `0.0.57`, Preevy runs a separate build step using the [`docker buildx bake`](https://docs.docker.com/engine/reference/commandline/buildx_bake/) command, before running the deploy step using `docker compose up`. Preevy can customize the build step to make use of BuildKit builders, and automatically configure caching for the build. These two features work together to speed up the creation of Preview Environments in your CI.

## Part 1: Offload the build

Preevy can use [BuildKit builders](https://docs.docker.com/build/builders/) to offload the build step out of the environment machine.

Specify a builder using the `--builder` flag at the `preevy up` command. If not specified, the [default builder](https://docs.docker.com/build/builders/#selected-builder) will be used.

Out-of-the-box, Docker's default builder uses the [Docker driver](https://docs.docker.com/build/drivers/docker/). This driver uses the connected Docker Server to build. Preevy sets the Docker Server to the provisioned machine's Docker Server (using the `DOCKER_HOST` environment variable), so the build runs there.

To run the build on the local machine (where the `preevy` CLI runs), or a remote server, configure a builder with a different driver. The [`docker buildx create` command](https://docs.docker.com/engine/reference/commandline/buildx_create) can be used to created a builder.

### Choosing a builder driver

- The [Docker container](https://docs.docker.com/build/drivers/docker-container/) driver is the simplest option - it will run the build on the Docker server of the local machine.
- Use the [Kubernetes driver](https://docs.docker.com/build/drivers/kubernetes/) to run the build on a Kubernetes cluster. Kubernetes can be set up to allocate powerful servers to the build.
- Use the [Remote driver](https://docs.docker.com/build/drivers/remote/) to connect to a remote BuildKit daemon.
- Use a 3rd party service like [Depot](https://depot.dev/docs/guides/docker-build) to host the build. Preevy can work with any builder that runs via `docker buildx build`.

### Setting up a builder in GitHub Actions

For GitHub actions, the [`setup-buildx-action`](https://github.com/marketplace/actions/docker-setup-buildx) can be used to simplify builder management.

## Part 2: Automatically configure cache

Preevy can automatically add the `cache_to` and `cache_from` directives in the [build section of the Compose file](https://docs.docker.com/compose/compose-file/build/) to specify a layer cache to be used when building your images.

To share the cache across different CI runs, it needs to be stored on a remote backend - not on the build machine, which is usually ephemeral.

Note that exporting a cache

### Generated image refs

To allow reusing the cached image layers, stable IDs are required for each image - the image refs. Preevy generates image refs for each service comprising of the Compose project name (usually the directory name), service name and the current git hash. It will then use the generated image refs to add `cache_from` and `cache_to` directives for each service build.

At the end of the build step, images will be pushed to the registry. Preevy will then run the provisioning step (`docker compose up`) with a modified Compose file which has the built image refs for each service. The result is a build which automatically uses the specified registry as a cache.

### Using an image registry as a cache backend

An [image registry](https://docs.docker.com/build/cache/backends/) can serve as a cache backend.

When the `--registry` flag is specified, Preevy can automatically add cache directives which use the registry to the Compose project.

#### Example

With this `docker-compose.yaml`:

```yaml
name: my-project  # if not specified, the Compose file directory name is used
services:
  frontend:
    build: .
```

And using the git hash `12abcdef`.

The command:

```bash
preevy up --registry my-registry --builder my-builder
```

Will result the following interim build Compose file:

```yaml
services:
  frontend:
    build:
      context: .
      tags:
        - my-registry/preevy-my-project-frontend:latest
        - my-registry/preevy-my-project-frontend:12abcdef
      cache_to:
        - type=registry,ref=my-registry/preevy-my-project-frontend:latest,mode=max,oci-mediatypes=true,image-manifest=true
      cache_from:
        - my-registry/preevy-my-project-frontend:latest
        - my-registry/preevy-my-project-frontend:12abcdef
```

At the end of the build step, the tagged image refs will be pushed to the `my-registry` registry.

The following Compose file will be deployed to the machine:

```yaml
services:
  frontend:
    build:
      image: my-registry/preevy-my-project-frontend:12abcdef
```

#### AWS ECR dance

Using Amazon [Elastic Container Registry](https://aws.amazon.com/ecr/) as your image registry requires creating a "repository" before pushing an image. When creating image refs for ECR, Preevy uses a slightly different scheme, because image names (the part after the slash) cannot be dynamic - so the dynamic part is moved to the tag.

Example, with the same project and registry above:

- Non-ECR image ref: `my-registry/my-project-frontend:12abcdef`
- ECR image ref for the existing repository `my-repo`: `my-registry/my-repo:my-project-frontend-12abcdef`

Preevy uses the ECR image ref scheme automatically when it detects an ECR registry name. This behavior can be enabled manually by specifying `--registry-single-name=<repo>`. Example: `--registry my-registry --registry-single-name=my-repo`. Auto-detection of ECR-style registries can be disabled by specifying `--no-registry-single-name`.

#### Choosing a registry

Several options exist:

* Creating a registry on the same cloud provider used by Preevy to provision the environment machines is usually inexpensive: [ECR](https://aws.amazon.com/ecr/) for AWS, [GAR](https://cloud.google.com/artifact-registry/) for Google Cloud, [ACR](https://azure.microsoft.com/en-us/products/container-registry/) for Azure.
* Creating a registry on the CI provider, e.g, [GHR](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry) on GitHub actions.
* [Docker Hub](https://www.docker.com/products/docker-hub/)
* [ttl.sh](https://ttl.sh/) is a free, ephemeral and anonymous image registry.
* Other 3rd party registries exist with some free tiers: JFrog, Treescale, Canister, GitLab

#### Careful when using a builder without a registry

Without a registry, Preevy will add the `--load` flag to the `docker buildx bake` command to load built images to the environment's Docker server. If the builder does not reside on the same Docker server, built images will be transferred over the network. So, when using a builder other than the default Docker builder, it is advised to also use a registry.

### Using GitHub Actions cache

[GitHub Actions](https://docs.docker.com/build/cache/backends/gha/) can also be used as a cache backend. The [Preevy GitHub Plugin](https://github.com/livecycle/preevy/tree/main/packages/plugin-github#readme) can add suitable cache directives to your services. Specify the [`--github-add-build-cache` flag](https://github.com/livecycle/preevy/tree/main/packages/plugin-github#github-docker-build-cache) to enable this feature.

See the [relevant section in the Docker docs](https://docs.docker.com/build/cache/backends/gha/#authentication) on how to enable authentication of the Docker CLI to the GitHub cache in your CI.

### Using other cache backends

More backends are described in the [Docker docs](https://docs.docker.com/build/cache/backends/).

## Manual optimization

If you already have an [efficient build pipeline](https://docs.docker.com/build/cache/) which creates images for the current commit, you can skip Preevy's build step entirely and provision an environment with existing images.

Specify `--no-build` to skip the build step. Preevy will run `docker compose up --no-build` with the given Compose file, which needs to have an `image` property for each service.

## Complete list of build-related flags

* `--no-build`: Skip the build step entirely
* `--registry=<name>`: Registry to use. Implies creating and pushing an image ref for each service at the build. Default: Do not use a registry and load built images to the environment's Docker server
* `--builder=<name>`: Builder to use. Defaults to the current buildx builder.
* `--registry-single-name=<repo>`: Use single name (ECR-style repository) in image refs.
* `--no-registry-cache`: Do not add `cache_from` and `cache_to` directives to the build Compose file
* `--no-cache`: Do not use cache when building the images
* `--github-add-build-cache`: Add GHA cache directives to all services

## Real world performance: A case study

Optimizing the CI build involves using multiple techniques while balancing their benefits and constraints. It might be useful to test and measure some combinations to make sure your CI setup works best for your specific use case.

We tested a [simple app](https://github.com/livecycle/preevy-gha-gce-demo) comprising of two built images (in addition to an external db image). In each run, Preevy was used to provision a Preview Environment in GitHub Actions on Google Cloud.

#### Environment machine sizes

Two machine sizes were tested:

`e2-small`: 2GB of memory, 0.5-2 vCPUs
`e2-medium`: 4GB of memory, 1-2 vCPUs

The small machine is good enough for running the app and costs exactly half of the bigger machine.

#### Build flag variations

A few variations of the builder, registry and cache were tested:

|Builder         |Registry|Cache|`preevy up` flags|
|:----------------|:--------|:-----|:-----------|
|Environment machine|none    |none    |None - this is the default build mode|
|CI machine|none    |none|`--builder=X`
|CI machine|none    |GHA| `--builder=X`<br/> `--github-add-build-cache` |
|CI machine|GHCR     |none| `--builder=X`<br/>`--registry=ghcr.io`
|CI machine|GHCR     |GHA| `--builder=X`<br/>`--registry=ghcr.io`<br/>`--github-add-build-cache`|
|CI machine|GAR     |none| `--builder=X`<br/>`--registry=my-docker.pkg.dev`|
|CI machine|GAR     |GHA| `--builder=X`<br/>`--registry=my-docker.pkg.dev`<br/>`--github-add-build-cache`|

##### Legend:

GHA: [GitHub Actions cache](https://github.com/actions/cache)
GHCR: [GitHub Container Registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
GAR: [Google Artifact Registry](https://cloud.google.com/artifact-registry/)

#### CI scenarios

A few scenarios were tested to simulate CI runs in different stages of the development process:

|Scenario|Description|Code changes|Environment machine exists?|Registry and cache populated?|
|:--|:--------|:------------|:---------------------------|:-----------------------------|
|**A**|From scratch - not likely in CI| |No|No|
|**B**|Commit to existing PR,<br/>no code changes| |Yes|Yes|
|**C**|Commit to existing PR,<br/>code changes|A JSX file|Yes|Yes|
|**D**|Commit to existing PR, dep changes|`package.json`|Yes|Yes
|**E**|First commit to new PR| |No|Yes|

#### Measurements

We measured the following steps in the build job:

- Setup: [copying files to/from the cache](https://docs.docker.com/build/ci/github-actions/cache/#cache-mounts), if a cache was used
- Build: the `docker buildx bake` command
- Deploy: the `docker compose up` command

VM preparation time was not measured.

### Results summary

Offloading the build to the stronger CI machine can reduce the cost of running preview environments significantly - in this sample case by nearly 50%!

- For the small environment machine, build was decidedly faster when done on the CI machine.
- For the bigger environment machine, it was faster to build a new PR on the CI machine, and especially fast with the GitHub registry (which has a good network connection to the CI machine).

### Discussion

Network transfers are a major cause for long builds. Both our GAR and the Environment VMs were in the same region, which is geographically remote from [GitHub's hosted CI runners](https://docs.github.com/en/actions/using-github-hosted-runners/about-github-hosted-runners).

Building on the Environment machine is advantageous: It does not require cache import/export, nor registry download/upload, and utilizes fully a local cache.

The performance benefits of using a registry and/or cache can be seen when building cross-branch.

### Full results

#### Scenario A: from scratch

This is an unlikely scenario in CI, but it serves as a control group for the others.

##### `e2-small` machine

|registry|builder|cache|setup time|build time|deploy time|total time|
|:-----|:------|:-----|:-----|:-----|:----|:-----|
| | CI&nbsp;machine | GHA | 18 | 116 | 34 | 169
|GAR | CI&nbsp;machine |  | 7 | 94 | 72 | 172
| | CI&nbsp;machine |  | 3 | 142 | 37 | 182
|GAR | CI&nbsp;machine | GHA | 13 | 105 | 66 | 183
| |  |  | 0 | 128 | 59 | 187
|GHCR | CI&nbsp;machine |  | 9 | 53 | 1091 | 1152
|GHCR | CI&nbsp;machine | GHA | 14 | 53 | 1101 | 1168

##### `e2-medium` machine

|registry|builder|cache|setup time|build time|deploy time|total time|
|:-----|:------|:-----|:-----|:-----|:----|:-----|
| | | | 0| 69| 26| 95
GHCR| CI&nbsp;machine| | 2| 47| 46| 95
GHCR| CI&nbsp;machine| GHA|  11| 50| 51| 113
GAR| CI&nbsp;machine| | 10| 76| 45| 130
| | CI&nbsp;machine| | 3| 115| 30| 148
| | CI&nbsp;machine| GHA| 7| 120| 30| 157
GAR| CI&nbsp;machine| GHA| 11| 92| 56| 159

#### Scenario B: commit to existing PR, no code changes

##### `e2-small` machine

|registry|builder|cache|setup time|build time|deploy time|total time|
|:-----|:------|:-----|:-----|:-----|:----|:-----|
|  |  |  | 0 | 9 | 6 | 15
| GHCR | CI&nbsp;machine | GHA | 9 | 11 | 5 | 24
| GHCR | CI&nbsp;machine |  | 10 | 8 | 5 | 23
| GAR | CI&nbsp;machine |  | 5 | 34 | 5 | 44
|  | CI&nbsp;machine | GHA | 9 | 51 | 5 | 65
| GAR | CI&nbsp;machine | GHA | 13 | 58 | 5 | 76
|  | CI&nbsp;machine |  | 2 | 101 | 29 | 132

##### `e2-medium` machine

|registry|builder|cache|setup time|build time|deploy time|total time|
|:-----|:------|:-----|:-----|:-----|:----|:-----|
| | | | 0| 8| 4| 13
| GHCR| CI&nbsp;machine| | 3| 7| 5| 15
| GHCR| CI&nbsp;machine| GHA| 13| 7| 5| 24
|GAR| CI&nbsp;machine| | 10| 36| 5| 51
| GAR| CI&nbsp;machine| GHA| 13| 34| 5| 52
| | CI&nbsp;machine| | 2| 96| 29| 127
| | CI&nbsp;machine| GHA| 15| 108| 29| 152

#### Scenario C: commit to existing PR with code changes

##### `e2-small` machine

|registry|builder|cache|setup time|build time|deploy time|total time|
|:-----|:------|:-----|:-----|:-----|:----|:-----|
|  |  |  | 0 | 9 | 27 | 36
| GHCR | CI&nbsp;machine |  | 2 | 24 | 31 | 57
| GHCR | CI&nbsp;machine | GHA | 9 | 30 | 52 | 91
| GAR | CI&nbsp;machine |  | 12 | 53 | 30 | 95
| GAR | CI&nbsp;machine | GHA | 12 | 59 | 32 | 102
|  | CI&nbsp;machine | GHA | 9 | 78 | 28 | 115
|  | CI&nbsp;machine |  | 6 | 112 | 30 | 147

##### `e2-medium` machine

|registry|builder|cache|setup time|build time|deploy time|total time|
|:-----|:------|:-----|:-----|:-----|:----|:-----|
|       | | | 0| 9| 26| 35
| GHCR| CI&nbsp;machine| | 3| 28| 34| 66
| GAR| CI&nbsp;machine| | 4| 67| 28| 99
| GAR| CI&nbsp;machine| GHA| 12| 63| 29| 104
| GHCR| CI&nbsp;machine| GHA| 10| 47| 56| 113
| | CI&nbsp;machine| GHA| 14| 91| 26| 132
| |     CI&nbsp;machine| | 3| 110| 30| 143

#### Scenario D: commit to existing PR with `package.json` changes

##### `e2-small` machine

|registry|builder|cache|setup time|build time|deploy time|total time|
|:-----|:------|:-----|:-----|:-----|:----|:-----|
| GHCR | CI&nbsp;machine | GHA | 10 | 43 | 52 | 105
|  | CI&nbsp;machine |  | 2 | 101 | 28 | 131
|  | CI&nbsp;machine | GHA | 9 | 97 | 28 | 134
| GAR | CI&nbsp;machine | GHA | 17 | 78 | 48 | 143
| GAR | CI&nbsp;machine |  | 6 | 96 | 48 | 151
|  |  |  | 0 | 123 | 30 | 153

##### `e2-medium` machine

|registry|builder|cache|setup time|build time|deploy time|total time|
|:-----|:------|:-----|:-----|:-----|:----|:-----|
| | | |  0|29| 27| 56
| GHCR| CI&nbsp;machine| GHA| 9| 49| 48| 106
| GHCR| CI&nbsp;machine| | 2| 64| 51| 116
| |       CI&nbsp;machine| |  2| 101| 30| 132
| GAR| CI&nbsp;machine| | 7| 100| 47| 155
| |       CI&nbsp;machine | GHA| 12| 121| 31| 163
| GAR| CI&nbsp;machine| GHA| 16| 104| 47| 167

#### Scenario E: first commit to new PR (machine does not exist)

##### `e2-small` machine

|registry|builder|cache|setup time|build time|deploy time|total time|
|:-----|:------|:-----|:-----|:-----|:----|:-----|
|  | CI&nbsp;machine |  | 3 | 117 | 37 | 157
| GAR | CI&nbsp;machine |  | 6 | 88 | 69 | 164
| GAR | CI&nbsp;machine | GHA | 17 | 91 | 66 | 174
 |  | | | 0 | 153 | 56 | 210
| GHCR | CI&nbsp;machine |  | 7 | 46 | 1066 | 1119
| GHCR | CI&nbsp;machine | GHA | 13 | 41 | 1082 | 1136

##### `e2-medium` machine

|registry|builder|cache|setup time|build time|deploy time|total time|
|:-----|:------|:-----|:-----|:-----|:----|:-----|
| GHCR| CI&nbsp;machine| | 8| 8| 62| 78
| GAR| CI&nbsp;machine| |  4|28| 59| 91
| GHCR| CI&nbsp;machine| GHA|  21|16| 57| 94
| |     | | 0| 71| 26| 96
| GAR| CI&nbsp;machine| GHA| 17| 30| 57| 104
| |     CI&nbsp;machine| GHA| 11| 82| 26| 119
| |     CI&nbsp;machine| | 7| 94| 27| 128
