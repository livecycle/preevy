---
title: Faster builds
sidebar_position: 2
---

## tl;dr

To build faster in your CI:

- Create and use BuildKit builders to offload resource-intensive builds.
- Specify the `--registry` flag to automatically add caching to your Compose build model.
- For fine-tuned optimization, create a Compose file for your CI to override the build parameters.

## Problem

By default, Preevy runs the build in the Docker server of the remote machine that Preevy provisions. Builds are often more resource intensive than the environment runtime - but those resources are only required when the environment is created or updated.

In addition, builds often run with no cache (especially when the machine was just created) taking longer than they should. Configuring a remote cache manually is possible, but requires some work.

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

## Part 2: Specify an image registry to automatically configure cache

The `cache_to` and `cache_from` directives in the [build section of the Compose file](https://docs.docker.com/compose/compose-file/build/) specify the caches to be used for each service.

To share the cache across different CI runs, it needs to be stored on a remote backend - not on the build machine, which is usually ephemeral. An [image registry](https://docs.docker.com/build/cache/backends/) can serve as a cache backend. Other more specific backends are described in the [Docker docs](https://docs.docker.com/build/cache/backends/).

When the `--registry` flag is specified, Preevy can automatically add cache directives which use the registry to the Compose project.

### Generated image refs

To allow reusing the cached image layers, stable IDs are required for each image - the image refs. Preevy generates image refs for each service comprising of the Compose project name (usually the directory name), service name and the current git hash. It will then use the generated image refs to add `cache_from` and `cache_to` directives for each service build.

At the end of the build step, images will be pushed to the registry. Preevy will then run the provisioning step (`docker compose up`) with a modified Compose file which has the built image refs for each service. The result is a build which automatically uses the specified registry as a cache.

### Example

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

### AWS ECR dance

Using Amazon [Elastic Container Registry](https://aws.amazon.com/ecr/) as your image registry requires creating a "repository" before pushing an image. When creating image refs for ECR, Preevy uses a slightly different scheme, because image names (the part after the slash) cannot be dynamic - so the dynamic part is moved to the tag.

Example, with the same project and registry above:

- Non-ECR image ref: `my-registry/my-project-frontend:12abcdef`
- ECR image ref for the existing repository `my-repo`: `my-registry/my-repo:my-project-frontend-12abcdef`

Preevy uses the ECR image ref scheme automatically when it detects an ECR registry name. This behavior can be enabled manually by specifying `--registry-single-name=<repo>`. Example: `--registry my-registry --registry-single-name=my-repo`. Auto-detection of ECR-style registries can be disabled by specifying `--no-registry-single-name`.

### Careful when using a builder without a registry

Not specifying the registry will disable automatic generation of image refs (and the addition of tag and cache directives) to the build Compose file. Built images will be loaded to the environment's Docker server. If the builder does not reside on the same Docker server, built images will have to be transferred over the network. So, when using a builder other than the default Docker builder, it is advised to also use a registry.

### What if I don't have a registry?

Several options exist:

* Creating a registry on the same cloud provider used by Preevy to provision the environment machines is usually inexpensive: [ECR](https://aws.amazon.com/ecr/) for AWS, [GAR](https://cloud.google.com/artifact-registry/) for Google Cloud, [ACR](https://azure.microsoft.com/en-us/products/container-registry/) for Azure.
* Creating a registry on the CI provider, e.g, [GHR](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry) on GitHub actions.
* [Docker Hub](https://www.docker.com/products/docker-hub/)
* [ttl.sh](https://ttl.sh/) is a free, ephemeral and anonymous image registry.
* Other 3rd party registries exist with some free tiers: JFrog, Treescale, Canister, GitLab

## Manual optimization

If you already have an efficient build pipeline which creates images for the current commit, you can skip Preevy's build step entirely and provision an environment with existing images.

Specify `--no-build` to skip the build step. Preevy will run `docker compose up --no-build` with the given Compose file, which needs to have an `image` property for each service.

## Complete list of build-related flags

* `--no-build`: Skip the build step entirely
* `--registry=<name>`: Registry to use. Implies creating and pushing an image ref for each service at the build. Default: Do not use a registry and load built images to the environment's Docker server
* `--builder=<name>`: Builder to use. Defaults to the current buildx builder.
* `--registry-single-name=<repo>`: Use single name (ECR-style repository) in image refs.
* `--no-registry-cache`: Do not add `cache_from` and `cache_to` directives to the build Compose file
* `--no-cache`: Do not use cache when building the images



