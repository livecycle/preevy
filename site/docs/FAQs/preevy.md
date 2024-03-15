---
title: FAQ - Preevy CLI
sidebar_label: Preevy CLI
sidebar_position: 15
---

## General questions about using the Preevy CLI

<details>
  <summary>Is the Preevy CLI free to use?</summary>

  Yes, the Preevy CLI is free to use.
</details>

<details>
  <summary> Is the Preevy CLI open source?</summary>

  Yes, the Preevy CLI is open source. You can find the source code on [Github](https://github.com/livecycle-io/preevy).
</details>

<details>
  <summary>Which frameworks and languages does the Preevy CLI support?</summary>

  The Preevy CLI is language and framework agnostic. It works with anything that runs in a Docker container.
</details>

<details>
  <summary>What security features does the Preevy CLI offer?</summary>

  The Preevy CLI uses a secure [SSH tunnel](https://livecycle.io/blogs/preevy-proxy-service-2/) to expose your local development environment using Livecycle's tunnel server, which is only accessible using HTTPS.

  You can enable private URLs to restrict access to your environment.
</details>

<details>
  <summary>Where do I report bugs?</summary>

  You can report bugs on [Github](https://github.com/livecycle-io/preevy/issues). Or you can join the [Livecycle Community](https://community.livecycle.io/) on Slack and report bugs there.
</details>

<details>
  <summary>How do I get support for Preevy CLI?</summary>

  Join the <a href="https://community.livecycle.io" target="_blank">Livecycle Community</a> on Slack to get support for Preevy CLI.
</details>

## Technical questions

<details>
  <summary>Can I expose only specific ports for a service?</summary>

  By default, Preevy exposes all the public TCP ports of a service defined in the Compose file.

  You can explicitly specify the ports to be exposed by defining a `preevy.expose` label on the service with the comma-separated list of port numbers to be exposed.

  Labels can defined in the Compose file (`compose.yaml` or `docker-compose.yaml`) as follows:
  ```yaml
services:
  my-service:
    build: ...
    labels:
      preevy.expose: 8000,8001
  ```
</details>

<details>
  <summary>Do you have examples for setting up a CI pipeline with Preview Environments using Preevy?</summary>

  Sure! Check out the following repos:

  - GitHub Actions:
    - [Preevy on Kubernetes using Google Cloud GKE and GAR](https://github.com/livecycle/preevy-gha-gke-demo)
    - [Preevy on Google Cloud VMs](https://github.com/livecycle/preevy-gha-gce-demo)

  - Don't have a Kubernetes cluster? See an [example repo](https://github.com/livecycle/preevy-terraform-eks-example) for setting up [AWS EKS](https://docs.aws.amazon.com/eks/latest/userguide/what-is-eks.html) using Terraform. The example includes [Karpenter](https://karpenter.sh/) which can reduce the cost of running Preview Environments by automatically expanding and shrinking your cluster using [EC2 Spot Instances](https://aws.amazon.com/ec2/spot/pricing/)

</details>
