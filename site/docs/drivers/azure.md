---
sidebar_position: 3
title: Microsoft Azure Driver
---

# Microsoft Azure Driver

Preevy can provision virtual machines on Microsoft Azure using the `azure` driver.
Microsoft Azure also offers free 12 months for new users which is suited for trying out preevy.

### Supported flags
- `--azure-region` - Microsoft Azure region in which resources will be provisioned
- `--azure-resource-group-name` - Microsoft Azure resource group name
- `--azure-subscription-id` - Microsoft Azure subscription id
- `--azure-vm-size` - Machine type to be provisioned, defaults to `Standard_B2s`

### Credentials Configuration
Preevy uses the Microsoft Azure SDK which can obtain the application [default credentials](https://github.com/Azure/azure-sdk-for-js/tree/main/sdk/identity/identity#defaultazurecredential).
The simplest way is to use `az login` command.

See the video below for a step-by-step guide on how to configure Azure credentials and use them with Preevy.

<p align="center"><iframe width="816" height="480" src="https://www.youtube.com/embed/AdoAzHuyzb0?si=0Yz5qSs-vpDDmz1k" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></p>

### Required Azure permissions

TBD
