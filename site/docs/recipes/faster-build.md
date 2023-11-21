---
title: Faster builds
sidebar_position: 2
---

## tl;dr

To build faster in your CI:

- Create and use BuildKit builders to offload resource-intensive builds.
- Specify the `--registry` flag to automatically add caching to your Compose build model.
- If using a non-Docker builder, reduce transfers of images over the network by also specifying `--registry`.
- For fine-tuned optimization, create a Compose file for your CI to override the build parameters.

## Problem

By default, Preevy runs the build in the Docker server of the remote machine Preevy provisions. Builds are often more resource intensive than the environment runtime - but those resources are only required when the environment is created or updated. Offloading the build step to a specialized server can reduce the memory, disk and CPU requirements of the machines provisioned for environments. It can also help speed up the build step so Preview Environments can be created faster in your CI.

## Solution

Starting with version `0.0.57`, Preevy runs a separate build step using the [`docker buildx bake`](https://docs.docker.com/engine/reference/commandline/buildx_bake/) command. Preevy can customize the build step to make use of BuildKit builders and build caches.

### Offload the build

Preevy can use [BuildKit builders](https://docs.docker.com/build/builders/) to offload the build step.

Specify a builder using the `--builder` flag at the `preevy up` command. If not specified, the [default builder](https://docs.docker.com/build/builders/#selected-builder) will be used.

Out-of-the-box, Docker configures a default builder with the [Docker driver](https://docs.docker.com/build/drivers/docker/). Preevy points the `docker` CLI to the provisioned machine's Docker Server (using the `DOCKER_HOST` environment variable), so the build runs there.

Using a different builder driver, the build can run on the local machine (where the `preevy` CLI runs), or on a remote server:

- The [Docker container](https://docs.docker.com/build/drivers/docker-container/) driver is the simplest option - it will run the build on the local Docker server.
- Use the [Kubernetes driver](https://docs.docker.com/build/drivers/kubernetes/) to run the build on a Kubernetes cluster.
- Use the [Remote driver](https://docs.docker.com/build/drivers/remote/) to connect to a remote BuildKit daemon.
- Use a 3rd party service like [Depot](https://depot.dev/docs/guides/docker-build) to host your build.

#### Setting up a builder in GitHub Actions

For GitHub actions, the [`setup-buildx-action`](https://github.com/marketplace/actions/docker-setup-buildx) can be used to simplify builder management.

### Specify an image registry to automatically configure cache

Reusing cached layers from previous builds can accelerate the build by skipping expensive build steps (e.g, `yarn install`). When creating Preview Environments In CI, cached image layers from the base branch, or previous builds of the same branch can be reused.

The `cache_to` and `cache_from` directives in the [build section of the Compose file](https://docs.docker.com/compose/compose-file/build/) specify the caches to be used for each service.

To share the cache across different CI runs, it needs to be stored remotely - not on the build machine, which is usually ephemeral. An [image registry](https://docs.docker.com/build/cache/backends/) is the most generic cache backend. Other more specific backends are described in the [Docker docs](https://docs.docker.com/build/cache/backends/).

Preevy can automatically add registry cache directives to your Compose file when the `--registry` flag is specified. To allow reusing the cached image layers, stable IDs are required for each image - the image refs. Preevy creates image refs for each service comprising of the Compose project name (usually the directory name), service name the current git hash. It will then use the image ref in `cache_from` and `cache_to` directives.

#### Example

With this `docker-compose.yaml`:

```yaml
name: my-project  # if not specified, the Compose file directory name is used
services:
  frontend:
    build: .
```

At git hash `12abcdef`.

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
        - my-registry/my-project-frontend:latest
        - my-registry/my-project-frontend:12abcdef
      cache_to:
        - type=registry,ref=my-registry/my-project-frontend:latest,mode=max,oci-mediatypes=true,image-manifest=true
      cache_from:
        - my-registry/my-project-frontend:latest
        - my-registry/my-project-frontend:12abcdef
```

At the end of the build step, the tagged image refs will be pushed to the `my-registry` registry.

The following Compose file will be deployed to the machine:

```yaml
services:
  frontend:
    build:
      image: my-registry/my-project-frontend:12abcdef
```

#### AWS ECR dance

Using Amazon Elastic Container Registry as your image registry requires creating a "repository" before pushing an image. The naming scheme for ECR images is different because image names (the part after the slash) cannot be dynamic - so the dynamic part is moved to the tag.

Example:
- Non-ECR image ref with registry `my-registry`: `my-registry/my-project-frontend:12abcdef`
- ECR image ref with registry `my-registry` and repository `my-repo`: `my-registry/my-repo:my-project-frontend-12abcdef`

Preevy handles the ECR image ref scheme automatically when it detects an ECR-style registry name. This behavior can be enabled manually by specifying `--registry-single-name` with the "repo" part of the ref. Example: `--registry my-registry --registry-single-name my-repo`. Auto-detection of ECR-style registries can be disabled by specifying `--no-registry-single-name`.

#### When no registry is specified

Not specifying the registry will disable automatic generation of image refs (and the addition of tag and cache directives) to the build Compose file. Built images will be loaded to the environment's Docker server. If the builder does not reside on the same Docker server, built images will have to be transferred over the network. So, when using a builder other than the default Docker builder, it is advised to also use a registry.

##### What if I don't have a registry?

Several options exist:

* Creating a registry on the same cloud provider used by Preevy to provision the environment machines is usually inexpensive: ECR if the environments run on AWS, GCR if on Google Cloud, etc.
* Creating a registry on the CI provider, e.g, GHR on GitHub actions.
* [Docker Hub](https://www.docker.com/products/docker-hub/)
* [ttl.sh](https://ttl.sh/) is a free, ephemeral and anonymous image registry.
* Other 3rd party registries exist with some free tiers: JFrog, Treescale, Canister, GitLab

### List of build flags

* `--no-build`: Skip the build step entirely
* `--registry=<name>`: Registry to use. Implies creating and pushing an image ref for each service at the build. Default: Do not use a registry and load built images to the environment's Docker server
* `--builder=<name>`: Builder to use. Defaults to the current buildx builder.
* `--registry-single-name=<repo>`: Use single name (ECR-style repository) in image refs.
* `--no-registry-cache`: Do not add `cache_from` and `cache_to` directives to the build Compose file
* `--no-cache`: Do not use cache when building the images

### Manual optimization

If you already have an efficient build pipeline which creates images for the current commit, you can skip Preevy's build step entirely and provision an environment with existing images.

Specify `--no-build` to skip the build step. Preevy will run `docker compose up --no-build` with the given Compose file, which needs to have an `image` property for each service.


