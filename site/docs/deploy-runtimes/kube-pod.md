---
sidebar_position: 4
title: Deploy to Kubernetes
---

# Kubernetes single Pod driver

Preevy can provision environments on a Kubernetes cluster using the bundled [Kubernetes single Pod driver](https://github.com/livecycle/preevy/blob/main/packages/driver-kube-pod/).

## Why deploy on Kubernetes?

If you're a Kubernetes user, the cost and time to provision ephemeral preview environments can be reduced considerably.

While preview environments live for the duration of a Pull Request, they will typically only see little bursts of actual usage. Kubernetes is a great way to oversubscribe compute resources. Environments can be configured to require little CPU and memory while idle and waiting for a review.

Deployments are faster on Kubernetes compared to your regular cloud provider VMs.

## How?

The driver creates a Kubernetes Pod running a Docker server for each environment (herby the name "single Pod"). Preevy then connects to the Docker server to build and run your services, just like it does on a regular VM.

Your services are still exposed using the Preevy Tunnel Service - there's no need to configure a specific ingress.

![Preevy on Kubernetes](kube-only-2.png)


## Requirements

- A Kubernetes cluster should be accessible from the CLI. A [`kubeconfig`](https://kubernetes.io/docs/concepts/configuration/organize-cluster-access-kubeconfig/) file may be specified - see [flags](#supported-flags) below.
- When using [RBAC authorization](https://kubernetes.io/docs/reference/access-authn-authz/rbac/), the default context needs permissions for running [exec](https://kubernetes.io/docs/tasks/debug/debug-application/get-shell-running-container/) and [port-forward](https://kubernetes.io/docs/tasks/access-application-cluster/port-forward-access-application-cluster/) for specific pods in the configured namespace.
- The [`kubectl`](https://kubernetes.io/docs/tasks/tools/#kubectl) tool needs to be installed and available in the PATH.
- By default, the driver runs a Pod with [`privileged: true` security context](https://kubernetes.io/docs/concepts/security/pod-security-standards/#privileged). In some cases, this requirement may be lifted by customizing the deployment template, see [below](#configuring-rootless-unprivileged-docker-in-docker).
- A StorageClass must be defined in the cluster to enable [dynamic volume provisioning](https://kubernetes.io/docs/concepts/storage/dynamic-provisioning/#enabling-dynamic-provisioning). This is usually pre-defined in your Kubernetes cluster.

## Supported options

| option | flag | default | env var | description |
| ---- | --- | -------- | ------- | ----------- |
|`namespace`|`--kube-pod-namespace`|`default`| |Kubernetes namespace to provision resources in|
|`kubeconfig`|`--kube-pod-kubeconfig`|`$HOME/.kube`| `KUBECONFIG` | path to a [`kubeconfig`](https://kubernetes.io/docs/concepts/configuration/organize-cluster-access-kubeconfig/) file|
|`pod-template`|`--kube-pod-template`|[default template](https://github.com/livecycle/preevy/blob/main/packages/driver-kube-pod/static/default-template.yaml.njk)| |path to a [nunjacks template](https://mozilla.github.io/nunjucks/templating.html) used to provision Kubernetes resources per environment. See [below](#customizing-the-provisioned-kubernetes-resources) for details|
|`server-side-apply`|`--[no-]kube-pod-server-side-apply`| true | | if true, provision resources using [server-side apply](https://kubernetes.io/docs/reference/using-api/server-side-apply/), else using client-side apply (CREATE/PATCH). Applies to `preevy up` only|
|`storage-class`|`--kube-pod-storage-class`| (undefined) | | The Kubernetes [StorageClass](https://kubernetes.io/docs/concepts/storage/storage-classes/) used in the StatefulSet template to provision the data volume for the Docker server in the Preevy environment Pod |
|`storage-size`|`--kube-pod-storage-size`| `5` | | Size in GiB of the volume allocated for the Docker server in the Preevy environment Pod. Adjust this acccording to the storage requirements of your environment. |

### Overriding options

Similar to other drivers, options are saved in the Preevy profile to be used as default values for all operations.

Options can be overridden for a specific compose file by adding them to the `x-preevy` section:

```yaml
services:
  ...
x-preevy:
  driver: kube-pod
  drivers:
    kube-pod:
      namespace: other-namespace
      storage-size: 12.5
```

Options can also be overridden using a CLI flag per command execution:

```bash
preevy up --kube-pod-namespace=other-namespace --kube-pod-storage-size=12.5
```

## Customizing the provisioned Kubernetes resources

It's possible to customize the Kubernetes resources provisioned by the driver per environment. Use cases include, but are not limited to:

- Customize the Docker Server image or the Docker Server configuration
- Add labels/annotations to the provisioned resources, e.g, for selecting specific Kubernetes nodes
- Provisioning additional resources per environment, e.g, a database server

The resources are specified as [Kubernetes object specs](https://kubernetes.io/docs/concepts/overview/working-with-objects/#describing-a-kubernetes-object) in a single YAML file rendered from a [nunjucks template](https://mozilla.github.io/nunjucks/templating.html). The template file may contain multiple definitions separated by lines containing `---` (three dashes).

Start by copying the [default template](https://github.com/livecycle/preevy/blob/main/packages/driver-kube-pod/static/default-template.yaml.njk). To use the custom template, enter the path to the custom template file at the `preevy init` or `preevy profile create` command, or specify the `--kube-pod-template` flag for the `preevy up` and `preevy down` commands. The template file at the specified path needs to be accessible at runtime to the CLI[^1].

[^1]: Embedding the template in the profile, or specifying its path in the `x-preevy` section of the Docker Compose file is in the roadmap, but not implemented yet.

### Requirements for the provisioned resources

All resources need to be deployed in a single namespace, specified as a template argument (see below).

While multiple [Kubernetes StatefulSet](https://kubernetes.io/docs/reference/kubernetes-api/workload-resources/stateful-set-v1/) objects may be defined, exactly one StatefulSet must have the label `app.kubernetes.io/component: docker-host`:
- The [status](https://kubernetes.io/docs/reference/kubernetes-api/workload-resources/stateful-set-v1/#StatefulSetStatus) of the StatefulSet is used to determine whether the Preevy environment is ready.
- The first [container](https://kubernetes.io/docs/reference/kubernetes-api/workload-resources/pod-v1/#containers) of the StatefulSet spec is used for copying files, so it [must have](https://kubernetes.io/docs/reference/kubectl/cheatsheet/#copying-files-and-directories-to-and-from-containers) the `tar` and `find` commands available.

A Docker server must be listening on port 2375 of the StatefulSet's Pod. As Preevy uses the [port-forward API](https://kubernetes.io/docs/tasks/access-application-cluster/port-forward-access-application-cluster/) to connect to the Docker server, it does not need to be exposed as a service. For the same reason, TLS is not supported and needs to be disabled for this port.

The Docker server must also be listening on the unix socket path `/var/run/docker.sock` - this is used by the Preevy agent service running alongside your services.

The lifecycle of all resources is tied to a Preevy environment - they will be created and deleted with the environment.

### Template arguments

The following arguments are specified when rendering the template:

- `namespace`: the Kubernetes namespace saved in the Preevy profile or specified in the `--kube-pod-namespace` flag. All resources must be defined in this namespace.
- `id`: A generated ID for this environment, 53 characters or less, comprised of the Preevy environment ID and a random suffix. `id` can be used as part of a label value, with up to 10 additional characters so as to not exceed the [63-character limit for labels](https://kubernetes.io/docs/concepts/overview/working-with-objects/labels/#syntax-and-character-set)
- `storageClass`: The [Kubernetes StorageClass](https://kubernetes.io/docs/concepts/storage/storage-classes/) used to [dynamically provision](https://kubernetes.io/docs/concepts/storage/dynamic-provisioning/) a volume for the StatefulSet. Saved in the Preevy profile or specified in the `--kube-pod-storage-class` flag. Leaving this undefined will cause the default storage class to be used.
- `storageSize`: The size of the allocated volume in GiB. Saved in the Preevy profile or specified in the `--kube-pod-storage-size` flag.

## Configuring rootless unprivileged Docker-in-Docker

By default, the Kubernetes Docker-in-Docker driver creates a [StatefulSet](https://kubernetes.io/docs/reference/kubernetes-api/workload-resources/stateful-set-v1/) which runs the [`docker:dind` image](https://hub.docker.com/_/docker). Traditionally, running Docker inside a container requires the [`privileged: true` security context](https://kubernetes.io/docs/concepts/security/pod-security-standards/#privileged), which may be a security concern.

[Sysbox](https://github.com/nestybox/sysbox) is an OSS project (acquired by Docker) that allows running unprivileged containers in a Kubernetes cluster. It can be [installed](https://github.com/nestybox/sysbox/blob/master/docs/user-guide/install-k8s.md) on most of the popular Kubernetes distros including managed cloud platforms like Amazon EKS, Google GKE, and Azure AKA. Once installed, a custom template can be used to [provision Pods](https://github.com/nestybox/sysbox/blob/master/docs/user-guide/deploy.md#deploying-pods-with-kubernetes--sysbox) without the `privileged` security context.
