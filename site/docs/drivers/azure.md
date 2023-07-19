---
sidebar_position: 3
title: Microsoft Azure Driver
---

# Microsoft Azure Driver

Preevy can provision virtual machines on Microsoft Azure using the `azure` driver.
Microsoft Azure also offer free 12 months for new users which is suited for trying out preevy.

### Supported flags
- `--azure-region` - Microsoft Azure region in which resources will be provisioned
- `--azure-resource-group-name` - Microsoft Azure resource group name
- `--azure-subscription-id` - Microsoft Azure subscription id
- `--azure-vm-size` - Machine type to be provisioned, defaults to `Standard_B2s`

### Credentials Configuration
Preevy uses the Microsoft Azure SDK which uses the `@azure/identity` package to get the application default credentials (https://github.com/Azure/azure-sdk-for-js/tree/main/sdk/identity/identity#defaultazurecredential).
The simplest way is to use `az login` command.

### Required Azure permissions

TBD




