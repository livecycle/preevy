---
title: Roadmap
sidebar_position: 7
---

# Roadmap

## More cloud drivers

Currently only [AWS lightsail](drivers/aws-lightsail.md) is supported, [GCP](https://cloud.google.com/), [Azure](https://azure.microsoft.com/) and [fly.io](https://fly.io/) are coming soon.

## Build customization

We plan to provide customization to the build process of the environment. Instead building the containers on the same machine they run on, we can save computing power and time by building on dedicated build machines, which are potentially faster than the runtime machine, or build on the local dev machine.

## Plugins

A plugin system is planned for Preevy providing a way to expand the preview environment with more functionality.
Examples:
* A plugin for providing a web-terminal for the inner containers
* A plugin for REST API calls (like [Hopscotch](https://hoppscotch.io/) or [Postman](https://www.postman.com/))
* A plugin to integrate with [Livecycle](https://livecycle.io/)
* Etc.
## Security

Add user/password protection for the exposed environments. Later, add [SSO](https://en.wikipedia.org/wiki/Single_sign-on) support.