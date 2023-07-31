`preevy profile`
================

View and update profile configuration

* [`preevy profile config update`](#preevy-profile-config-update)
* [`preevy profile config view`](#preevy-profile-config-view)
* [`preevy profile create NAME URL`](#preevy-profile-create-name-url)
* [`preevy profile current`](#preevy-profile-current)
* [`preevy profile import LOCATION`](#preevy-profile-import-location)
* [`preevy profile ls`](#preevy-profile-ls)
* [`preevy profile rm NAME`](#preevy-profile-rm-name)
* [`preevy profile use NAME`](#preevy-profile-use-name)

## `preevy profile config update`

View and update profile configuration

```
USAGE
  $ preevy profile config update [-D] [-f <value>] [--system-compose-file <value>] [-p <value>] [--lightsail-region
    us-east-2|us-east-1|us-west-2|ap-south-1|ap-northeast-2|ap-southeast-1|ap-southeast-2|ap-northeast-1|ca-central-1|eu
    -central-1|eu-west-1|eu-west-2|eu-west-3|eu-north-1] [--gce-project-id <value>] [--gce-zone <value>] [--azure-region
    <value>] [--azure-subscription-id <value>] [--kube-pod-namespace <value>] [--kube-pod-kubeconfig <value>]
    [--kube-pod-context <value>] [--kube-pod-template <value>] [--lightsail-availability-zone <value>]
    [--lightsail-bundle-id nano_2_0|micro_2_0|small_2_0|medium_2_0|large_2_0|xlarge_2_0|2xlarge_2_0] [--gce-machine-type
    <value>] [--azure-vm-size <value>] [--azure-resource-group-name <value>] [--kube-pod-server-side-apply] [--unset
    <value>] [--json]

FLAGS
  --unset=<value>...  Unset a configuration option

GLOBAL FLAGS
  -D, --debug                       Enable debug logging
  -f, --file=<value>...             [default: ] Compose configuration file
  -p, --project=<value>             Project name. Defaults to the Compose project name
  --json                            Format output as json.
  --system-compose-file=<value>...  [default: ] Add extra Compose configuration file without overriding the defaults

AZURE DRIVER FLAGS
  --azure-region=<value>               Microsoft Azure region in which resources will be provisioned
  --azure-resource-group-name=<value>  Microsoft Azure resource group name
  --azure-subscription-id=<value>      Microsoft Azure subscription id
  --azure-vm-size=<value>              Machine type to be provisioned

GCE DRIVER FLAGS
  --gce-machine-type=<value>  Machine type to be provisioned
  --gce-project-id=<value>    Google Cloud project ID
  --gce-zone=<value>          Google Cloud zone in which resources will be provisioned

KUBE-POD DRIVER FLAGS
  --kube-pod-context=<value>         Path to kubeconfig file (will load config from defaults if not specified)
  --kube-pod-kubeconfig=<value>      Path to kubeconfig file (will load config from defaults if not specified)
  --kube-pod-namespace=<value>       Kubernetes namespace in which resources will be provisioned (needs to exist)
  --[no-]kube-pod-server-side-apply  Use server side apply to create Kubernetes resources
  --kube-pod-template=<value>        Path to custom resources template file (will use default template if not specified)

LIGHTSAIL DRIVER FLAGS
  --lightsail-availability-zone=<value>  AWS availability zone to provision resources in region
  --lightsail-bundle-id=<option>         Lightsail bundle ID (size of instance) to provision. Default: medium_2_0
                                         <options:
                                         nano_2_0|micro_2_0|small_2_0|medium_2_0|large_2_0|xlarge_2_0|2xlarge_2_0>
  --lightsail-region=<option>            AWS region in which resources will be provisioned
                                         <options: us-east-2|us-east-1|us-west-2|ap-south-1|ap-northeast-2|ap-southeast-
                                         1|ap-southeast-2|ap-northeast-1|ca-central-1|eu-central-1|eu-west-1|eu-west-2|e
                                         u-west-3|eu-north-1>

DESCRIPTION
  View and update profile configuration
```

## `preevy profile config view`

View profile configuration

```
USAGE
  $ preevy profile config view [-D] [-f <value>] [--system-compose-file <value>] [-p <value>] [--json]

GLOBAL FLAGS
  -D, --debug                       Enable debug logging
  -f, --file=<value>...             [default: ] Compose configuration file
  -p, --project=<value>             Project name. Defaults to the Compose project name
  --json                            Format output as json.
  --system-compose-file=<value>...  [default: ] Add extra Compose configuration file without overriding the defaults

DESCRIPTION
  View profile configuration
```

## `preevy profile create NAME URL`

Create a new profile

```
USAGE
  $ preevy profile create NAME URL -d lightsail|gce|azure|kube-pod [-D] [-f <value>] [--system-compose-file <value>]
    [-p <value>] [--lightsail-region us-east-2|us-east-1|us-west-2|ap-south-1|ap-northeast-2|ap-southeast-1|ap-southeast
    -2|ap-northeast-1|ca-central-1|eu-central-1|eu-west-1|eu-west-2|eu-west-3|eu-north-1] [--gce-project-id <value>]
    [--gce-zone <value>] [--azure-region <value>] [--azure-subscription-id <value>] [--kube-pod-namespace <value>]
    [--kube-pod-kubeconfig <value>] [--kube-pod-context <value>] [--kube-pod-template <value>]
    [--lightsail-availability-zone <value>] [--lightsail-bundle-id
    nano_2_0|micro_2_0|small_2_0|medium_2_0|large_2_0|xlarge_2_0|2xlarge_2_0] [--gce-machine-type <value>]
    [--azure-vm-size <value>] [--azure-resource-group-name <value>] [--kube-pod-server-side-apply] [--json]

ARGUMENTS
  NAME  name of the new profile
  URL   url of the new profile store

FLAGS
  -d, --driver=<option>  (required) Machine driver to use
                         <options: lightsail|gce|azure|kube-pod>

GLOBAL FLAGS
  -D, --debug                       Enable debug logging
  -f, --file=<value>...             [default: ] Compose configuration file
  -p, --project=<value>             Project name. Defaults to the Compose project name
  --json                            Format output as json.
  --system-compose-file=<value>...  [default: ] Add extra Compose configuration file without overriding the defaults

AZURE DRIVER FLAGS
  --azure-region=<value>               Microsoft Azure region in which resources will be provisioned
  --azure-resource-group-name=<value>  Microsoft Azure resource group name
  --azure-subscription-id=<value>      Microsoft Azure subscription id
  --azure-vm-size=<value>              [default: Standard_B2s] Machine type to be provisioned

GCE DRIVER FLAGS
  --gce-machine-type=<value>  Machine type to be provisioned
  --gce-project-id=<value>    Google Cloud project ID
  --gce-zone=<value>          Google Cloud zone in which resources will be provisioned

KUBE-POD DRIVER FLAGS
  --kube-pod-context=<value>         Path to kubeconfig file (will load config from defaults if not specified)
  --kube-pod-kubeconfig=<value>      Path to kubeconfig file (will load config from defaults if not specified)
  --kube-pod-namespace=<value>       [default: default] Kubernetes namespace in which resources will be provisioned
                                     (needs to exist)
  --[no-]kube-pod-server-side-apply  Use server side apply to create Kubernetes resources
  --kube-pod-template=<value>        Path to custom resources template file (will use default template if not specified)

LIGHTSAIL DRIVER FLAGS
  --lightsail-availability-zone=<value>  AWS availability zone to provision resources in region
  --lightsail-bundle-id=<option>         Lightsail bundle ID (size of instance) to provision. Default: medium_2_0
                                         <options:
                                         nano_2_0|micro_2_0|small_2_0|medium_2_0|large_2_0|xlarge_2_0|2xlarge_2_0>
  --lightsail-region=<option>            AWS region in which resources will be provisioned
                                         <options: us-east-2|us-east-1|us-west-2|ap-south-1|ap-northeast-2|ap-southeast-
                                         1|ap-southeast-2|ap-northeast-1|ca-central-1|eu-central-1|eu-west-1|eu-west-2|e
                                         u-west-3|eu-north-1>

DESCRIPTION
  Create a new profile
```

## `preevy profile current`

Display current profile in use

```
USAGE
  $ preevy profile current [-D] [-f <value>] [--system-compose-file <value>] [-p <value>] [--json]

GLOBAL FLAGS
  -D, --debug                       Enable debug logging
  -f, --file=<value>...             [default: ] Compose configuration file
  -p, --project=<value>             Project name. Defaults to the Compose project name
  --json                            Format output as json.
  --system-compose-file=<value>...  [default: ] Add extra Compose configuration file without overriding the defaults

DESCRIPTION
  Display current profile in use
```

## `preevy profile import LOCATION`

Import an existing profile

```
USAGE
  $ preevy profile import LOCATION [-D] [-f <value>] [--system-compose-file <value>] [-p <value>] [--name <value>]
    [--json]

ARGUMENTS
  LOCATION  location of the profile

FLAGS
  --name=<value>  name of the profile

GLOBAL FLAGS
  -D, --debug                       Enable debug logging
  -f, --file=<value>...             [default: ] Compose configuration file
  -p, --project=<value>             Project name. Defaults to the Compose project name
  --json                            Format output as json.
  --system-compose-file=<value>...  [default: ] Add extra Compose configuration file without overriding the defaults

DESCRIPTION
  Import an existing profile
```

## `preevy profile ls`

Lists profiles

```
USAGE
  $ preevy profile ls [-D] [-f <value>] [--system-compose-file <value>] [-p <value>] [--json]

GLOBAL FLAGS
  -D, --debug                       Enable debug logging
  -f, --file=<value>...             [default: ] Compose configuration file
  -p, --project=<value>             Project name. Defaults to the Compose project name
  --json                            Format output as json.
  --system-compose-file=<value>...  [default: ] Add extra Compose configuration file without overriding the defaults

DESCRIPTION
  Lists profiles
```

## `preevy profile rm NAME`

Remove a profile

```
USAGE
  $ preevy profile rm NAME [-D] [-f <value>] [--system-compose-file <value>] [-p <value>] [--json]

ARGUMENTS
  NAME  name of the profile to remove

GLOBAL FLAGS
  -D, --debug                       Enable debug logging
  -f, --file=<value>...             [default: ] Compose configuration file
  -p, --project=<value>             Project name. Defaults to the Compose project name
  --json                            Format output as json.
  --system-compose-file=<value>...  [default: ] Add extra Compose configuration file without overriding the defaults

DESCRIPTION
  Remove a profile
```

## `preevy profile use NAME`

Set current profile

```
USAGE
  $ preevy profile use NAME [-D] [-f <value>] [--system-compose-file <value>] [-p <value>] [--json]

ARGUMENTS
  NAME  name of the profile to use

GLOBAL FLAGS
  -D, --debug                       Enable debug logging
  -f, --file=<value>...             [default: ] Compose configuration file
  -p, --project=<value>             Project name. Defaults to the Compose project name
  --json                            Format output as json.
  --system-compose-file=<value>...  [default: ] Add extra Compose configuration file without overriding the defaults

DESCRIPTION
  Set current profile
```
