---
title: Observability
sidebar_position: 13
---

# Roadmap

## More cloud drivers

- [x] [AWS lightsail](drivers/aws-lightsail.md)
- [x] [GCP Compute Engine](drivers/gcp-gce.md)
- [x] [Azure](https://azure.microsoft.com/)
- [x] [Kubernetes](drivers/kube-pod.md)
- [ ] [fly.io](https://fly.io/)

## Plugins

A plugin system exists for Preevy providing a way to expand the preview environment with more functionality.
Examples:
* A plugin for providing a web-terminal for the inner containers
* A plugin for REST API calls (like [Hopscotch](https://hoppscotch.io/) or [Postman](https://www.postman.com/))
* A plugin to integrate with [Livecycle](https://livecycle.io/)
* Etc.
## Security

Add user/password protection for the exposed environments. Later, add [SSO](https://en.wikipedia.org/wiki/Single_sign-on) support.