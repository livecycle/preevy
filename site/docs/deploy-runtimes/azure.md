---
sidebar_position: 3
title: Deploy to Microsoft Azure
---

# Microsoft Azure Driver

Preevy can provision virtual machines on Microsoft Azure using the `azure` driver.
Microsoft Azure also offers free 12 months for new users which is suited for trying out preevy.

### Supported options

| option | flag | description | required | default |
| ------ | ---- | ----------- | -------- | ------- |
| `region` | `--azure-region` | Microsoft Azure region in which resources will be provisioned | required | (none) |
| `subscription-id` | `--azure-subscription-id` | Microsoft Azure subsription ID | required | (none) |
| `vm-size` | `--azure-vm-size` | Machine type to be provisioned | optional | `Standard_B2s` |

### Overriding options

Similar to other drivers, options are saved in the Preevy profile to be used as default values for all operations.

Options can be overridden for a specific compose file by adding them to the `x-preevy` section:

```yaml
services:
  ...
x-preevy:
  driver: azure
  drivers:
    azure:
      vm-size: DS3_v2
```

Options can also be overridden using a CLI flag per command execution:

```bash
preevy up --azure-vm-size=DS3_v2
```

### Credentials Configuration
Preevy uses the Microsoft Azure SDK which can obtain the application [default credentials](https://github.com/Azure/azure-sdk-for-js/tree/main/sdk/identity/identity#defaultazurecredential).
The simplest way is to use `az login` command.

See the video below for a step-by-step guide on how to configure Azure credentials and use them with Preevy.

<p align="center"><iframe width="816" height="480" src="https://www.youtube.com/embed/AdoAzHuyzb0?si=0Yz5qSs-vpDDmz1k" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></p>

### Required Azure permissions

TBD
