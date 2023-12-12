---
sidebar_position: 2
title: Deploy to Google Cloud Platform
---

# GCP Compute Engine Driver

Preevy can provision virtual machines on GCP using the `gce` driver.
Google compute engine provisioning time for a VM is usually less than a minute, the default machine size in use is e2-small (2GB, 2vCpu) which costs around $12 per month.
Google compute also offer $300 free credit for new users which is suited for trying out preevy.

### Supported options

| option | flag | description | required | default |
| ------ | ---- | ----------- | -------- | ------- |
| `project-id` | `--gce-project-id` | Google Cloud project ID | required | (none) |
| `zone` | `--gce-zone` | Google Cloud zone in which resources will be provisioned | required | (none) |
| `machine-type` | `--gce-machine-type` | Machine type to be provisioned | optional | `e2-small` |

### Overriding options

Similar to other drivers, options are saved in the Preevy profile to be used as default values for all operations.

Options can be overridden for a specific compose file by adding them to the `x-preevy` section:

```yaml
services:
  ...
x-preevy:
  driver: gce
  drivers:
    gce:
      machine-type: e2-medium
```

Options can also be overridden using a CLI flag per command execution:

```bash
preevy up --gce-machine-type=e2-medium
```

### Credentials Configuration
Preevy uses the Google SDK which uses application default credentials (https://cloud.google.com/docs/authentication/application-default-credentials).
The simplest way is to use `gcloud auth application-default login` command.

Also, you can check out the video below for a step-by-step guide on how to configure GCP credentials ans use them with Preevy.

<p align="center"><iframe width="816" height="480" src="https://www.youtube.com/embed/T9x15amj_CY?si=PTiopbOCGo5N8xnD" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></p>

### Required GCE permissions

TBD
