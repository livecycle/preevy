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

