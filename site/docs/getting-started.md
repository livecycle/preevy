---
title: Installing the Preevy CLI
sidebar_position: 1.2
---

<span style={{ fontSize: "x-large" }}>
  Provision <span style={{ fontStyle: "italic" }}>preview environments</span>{" "}
  for Docker Compose applications with minimal configuration
</span>

## Introduction

Use Preevy to provision your [Docker Compose](https://docs.docker.com/compose/) application with minimal configurations.<br/>
Simply run `preevy up`, and Preevy will return a public URL for every service in your configuration.

You can read more about the Preevy [origin story and motivation](/intro/motivation).

## Prerequisites

- Node.js installed.
- Docker and Docker Compose V2 installed.

## Getting Started

Preevy is designed to be easy to use, with an API smiliar to [Docker Compose](https://docs.docker.com/compose/).

1. Install Preevy CLI globally

  ```bash npm2yarn
  npm install -g preevy
  ```

  Or use `npx` to run the CLI without installing it:

  ```bash
  npx preevy <command>
  ```

2. Choose the cloud provider or Kubernetes cluster you're going to use and configure credentials:
   - For AWS: use `aws configure`. See [AWS lightsail credentials configurations](/cloud-providers/aws-lightsail#credentials-configuration).
   - For GCP: use `gcloud auth application-default login`. See [GCP credentials configuration](/cloud-providers/gcp-gce#credentials-configuration)
   - For Azure: use `az login`. See [Azure credentials configuration](/cloud-providers/azure#credentials-configuration)
   - For Kubernetes: See [Kubernetes credentials configuration](/cloud-providers/kube-pod#requirements)

3. Set up a profile

  ```bash
  preevy init
  ```

4. From the same directory where your `docker-compose.yml` or `compose.yml` file is located, run the command below, ensuring Docker is running:

  ```bash
  preevy up
  ```

**Note:** Preevy uses the git repo at the current directory to calculate a stable environment ID for your project. Make sure a git repo is initialized (with at least one commit), or add the `--id` flag to explicitly specify the environment ID.


:::info Cloud provider credentials
Managing and provisioning preview environments in Preevy, requires access and credentials to a cloud provider or Kubernetes cluster. Currently AWS, GCP, Azure and Kubernetes are supported, but more providers are [coming soon](/roadmap#more-cloud-drivers).
Once you install and initialize your cloud provider CLI, Preevy will recognize and employ your configuration settings.


For more info, see [AWS lightsail credentials configurations](/cloud-providers/aws-lightsail#credentials-configuration), [GCP credentials configuration](/cloud-providers/gcp-gce#credentials-configuration), [Azure credentials configuration](/cloud-providers/azure#credentials-configuration) and [Kubernetes credentials configuration](/cloud-providers/kube-pod#requirements).
:::
