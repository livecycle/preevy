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
|**A**|Control group| |No|No|
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

- Default mode was fastest in the control group, and in all cases where the VM already existed (existing PR).
- Using the GitHub registry without the GitHub cache was fastest when the VM is new (new PR).

### Discussion

Network transfers are a major cause for long builds. Both our GAR and the Environment VMs were in the same region, which is geographically remote from [GitHub's hosted CI runners](https://docs.github.com/en/actions/using-github-hosted-runners/about-github-hosted-runners).

Building on the Environment machine is advantageous: It does not require cache import/export, nor registry download/upload, and utilizes fully a local cache.

The performance benefits of using a registry and/or cache can be seen when building cross-branch.

Other benefits of offloading the builds which were not tested here are:

* Utilizing stronger build machines
* Decreasing the requirements and cost of the Environment machines

### Full results

#### Scenario A - Control group

|registry|builder|cache|build time|deploy time|setup time|total time|
|:-----|:------|:-----|:-----|:-----|:----|:-----|
| | | | 68.968| 25.652| 0| 94.62
GHCR| CI&nbsp;machine| | 46.937| 46.29| 2| 95.227
GHCR| CI&nbsp;machine| GHA| 50.397| 51.284| 11| 112.681
GAR| CI&nbsp;machine| | 75.593| 44.862| 10| 130.455
| | CI&nbsp;machine| | 114.501| 30.052| 3| 147.553
| | CI&nbsp;machine| GHA| 120.074| 30.15| 7| 157.224
GAR| CI&nbsp;machine| GHA| 92.174| 55.758| 11| 158.932

#### Scenario B - Commit to existing PR, no code changes

|registry|builder|cache|build time|deploy time|setup time|total time|
|:-----|:------|:-----|:-----|:-----|:----|:-----|
| | | | 8.362| 4.237| 0| 12.599
| GHCR| CI&nbsp;machine| | 7.311| 5.094| 3| 15.405
| GHCR| CI&nbsp;machine| GHA| 6.881| 4.524| 13| 24.405
|GAR| CI&nbsp;machine| | 36.251| 4.54| 10| 50.791
| GAR| CI&nbsp;machine| GHA| 34.363| 4.565| 13| 51.928
| | CI&nbsp;machine| | 96.284| 28.839| 2| 127.123
| | CI&nbsp;machine| GHA| 108.243| 28.514| 15| 151.757

#### Scenario C - Commit to existing PR with code changes

|registry|builder|cache|build time|deploy time|setup time|total time|
|:-----|:------|:-----|:-----|:-----|:----|:-----|
| 	| | | 8.629| 26.29| 0| 34.919
| GHCR| CI&nbsp;machine| | 28.49| 34.341| 3| 65.831
| GAR| CI&nbsp;machine| | 66.72| 28.382| 4| 99.102
| GAR| CI&nbsp;machine| GHA| 63.47| 28.537| 12| 104.007
| GHCR| CI&nbsp;machine| GHA| 46.589| 56.05| 10| 112.639
| | CI&nbsp;machine| GHA| 91.149| 26.397| 14| 131.546
| |	CI&nbsp;machine| | 110.388| 29.924| 3| 143.312

#### Scenario D - Commit to existing PR with `package.json` changes

|registry|builder|cache|build time|deploy time|setup time|total time|
|:-----|:------|:-----|:-----|:-----|:----|:-----|
| | | | 29.404| 26.515| 0| 55.919
| GHCR| CI&nbsp;machine| GHA| 48.826| 48.05| 9| 105.876
| GHCR| CI&nbsp;machine| | 63.608| 50.872| 2| 116.48
| 	CI&nbsp;machine| | | 100.53| 29.61| 2| 132.14
| GAR| CI&nbsp;machine| | 100.26| 47.276| 7| 154.536
| 	CI&nbsp;machine| | GHA| 120.549| 30.57| 12| 163.119
| GAR| CI&nbsp;machine| GHA| 104.126| 46.926| 16| 167.052

#### Scenario E - First commit to new PR (machine does not exist)

|registry|builder|cache|build time|deploy time|setup time|total time|
|:-----|:------|:-----|:-----|:-----|:----|:-----|
| GHCR| CI&nbsp;machine| | 8.442| 62.054| 8| 78.496
| GAR| CI&nbsp;machine| | 28.025| 58.529| 4| 90.554
| GHCR| CI&nbsp;machine| GHA| 16.103| 57.076| 21| 94.179
| | 	| | 70.513| 25.602| 0| 96.115
| GAR| CI&nbsp;machine| GHA| 30.289| 57.191| 17| 104.48
| | 	CI&nbsp;machine| GHA| 81.732| 25.832| 11| 118.564
| | 	CI&nbsp;machine| | 94.371| 26.617| 7| 127.988