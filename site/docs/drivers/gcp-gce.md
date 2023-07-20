---
sidebar_position: 2
title: GCP Compute Engine Driver
---

# GCP Compute Engine Driver

Preevy can provision virtual machines on GCP using the `gce` driver.
Google compute engine provisioning time for a VM is usually less than a minute, the default machine size in use is e2-small (2GB, 2vCpu) which costs around $12 per month.
Google compute also offer $300 free credit for new users which is suited for trying out preevy.

### Supported flags
- `--gce-machine-type` - Machine type to be provisioned.
- `--gce-profile-id` - Google Cloud project ID.
- `--gce-zone` - Google Cloud zone in which resources will be provisioned.

### Credentials Configuration
Preevy uses the Google SDK which uses application default credentials (https://cloud.google.com/docs/authentication/application-default-credentials).
The simplest way is to use `gcloud auth application-default login` command.

### Required GCE permissions

TBD
