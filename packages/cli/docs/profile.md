`preevy profile`
================

View and update profile configuration

* [`preevy profile config update`](#preevy-profile-config-update)
* [`preevy profile config view`](#preevy-profile-config-view)
* [`preevy profile cp`](#preevy-profile-cp)
* [`preevy profile create NAME URL`](#preevy-profile-create-name-url)
* [`preevy profile current`](#preevy-profile-current)
* [`preevy profile import LOCATION`](#preevy-profile-import-location)
* [`preevy profile key [TYPE]`](#preevy-profile-key-type)
* [`preevy profile link`](#preevy-profile-link)
* [`preevy profile ls`](#preevy-profile-ls)
* [`preevy profile rm NAME`](#preevy-profile-rm-name)
* [`preevy profile use NAME`](#preevy-profile-use-name)

## `preevy profile config update`

View and update profile configuration

```
USAGE
  $ preevy profile config update [--json] [-D] [-f <value>] [--system-compose-file <value>] [--project-directory <value>]
    [-p <value>] [--enable-plugin <value>] [--disable-plugin <value>] [--profile <value>] [--lightsail-region <value>]
    [--gce-project-id <value>] [--gce-zone <value>] [--azure-region <value>] [--azure-subscription-id <value>]
    [--kube-pod-namespace <value>] [--kube-pod-kubeconfig <value>] [--kube-pod-context <value>]
    [--lightsail-availability-zone <value>] [--lightsail-bundle-id
    nano_2_0|micro_2_0|small_2_0|medium_2_0|large_2_0|xlarge_2_0|2xlarge_2_0] [--gce-machine-type <value>]
    [--azure-vm-size <value>] [--kube-pod-template <value>] [--kube-pod-server-side-apply] [--kube-pod-storage-class
    <value>] [--kube-pod-storage-size <value>] [-d lightsail|gce|azure|kube-pod] [--unset
    lightsail-region|gce-project-id|gce-zone|azure-region|azure-subscription-id|kube-pod-namespace|kube-pod-kubeconfig|k
    ube-pod-context|lightsail-availability-zone|lightsail-bundle-id|gce-machine-type|azure-vm-size|kube-pod-template|kub
    e-pod-server-side-apply|kube-pod-storage-class|kube-pod-storage-size]

FLAGS
  -d, --driver=<option>            Machine driver to use
                                   <options: lightsail|gce|azure|kube-pod>
      --profile=<value>            Run in a specific profile context (either an alias or a URL)
      --project-directory=<value>  Alternate working directory (default: the path of the first specified Compose file)
      --unset=<option>...          [default: ] Unset a configuration option
                                   <options: lightsail-region|gce-project-id|gce-zone|azure-region|azure-subscription-id
                                   |kube-pod-namespace|kube-pod-kubeconfig|kube-pod-context|lightsail-availability-zone|
                                   lightsail-bundle-id|gce-machine-type|azure-vm-size|kube-pod-template|kube-pod-server-
                                   side-apply|kube-pod-storage-class|kube-pod-storage-size>

GLOBAL FLAGS
  -D, --debug                           Enable debug logging
  -f, --file=<value>...                 [default: ] Compose configuration file
  -p, --project=<value>                 Project name. Defaults to the Compose project name
      --disable-plugin=<value>...       Disable plugin with specified package name
      --enable-plugin=<value>...        [default: @preevy/plugin-github] Enable plugin with specified package name
      --json                            Format output as json.
      --system-compose-file=<value>...  [default: ] Add extra Compose configuration file without overriding the defaults

AZURE DRIVER FLAGS
  --azure-region=<value>           Microsoft Azure region in which resources will be provisioned
  --azure-subscription-id=<value>  Microsoft Azure Subscription ID
  --azure-vm-size=<value>          Machine type to be provisioned

GCE DRIVER FLAGS
  --gce-machine-type=<value>  Machine type to be provisioned
  --gce-project-id=<value>    Google Cloud project ID
  --gce-zone=<value>          Google Cloud zone in which resources will be provisioned

KUBE-POD DRIVER FLAGS
  --kube-pod-context=<value>         kubeconfig context name (will load config from defaults if not specified)
  --kube-pod-kubeconfig=<value>      Path to kubeconfig file (will load config from defaults if not specified)
  --kube-pod-namespace=<value>       Kubernetes namespace in which resources will be provisioned (needs to exist)
  --[no-]kube-pod-server-side-apply  Use server side apply to create Kubernetes resources
  --kube-pod-storage-class=<value>   Storage class to use for Pod data volume
  --kube-pod-storage-size=<value>    Size of Pod data volume in GiB
  --kube-pod-template=<value>        Path to custom resources template file (will use default template if not specified)

LIGHTSAIL DRIVER FLAGS
  --lightsail-availability-zone=<value>  AWS availability zone to provision resources in region
  --lightsail-bundle-id=<option>         Lightsail bundle ID (size of instance) to provision. Default: medium_2_0
                                         <options:
                                         nano_2_0|micro_2_0|small_2_0|medium_2_0|large_2_0|xlarge_2_0|2xlarge_2_0>
  --lightsail-region=<value>             AWS region in which resources will be provisioned

DESCRIPTION
  View and update profile configuration
```

_See code: [src/commands/profile/config/update.ts](https://github.com/livecycle/preevy/blob/v0.0.60/src/commands/profile/config/update.ts)_

## `preevy profile config view`

View profile configuration

```
USAGE
  $ preevy profile config view [--json] [-D] [-f <value>] [--system-compose-file <value>] [--project-directory <value>]
    [-p <value>] [--enable-plugin <value>] [--disable-plugin <value>] [--profile <value>]

FLAGS
  --profile=<value>            Run in a specific profile context (either an alias or a URL)
  --project-directory=<value>  Alternate working directory (default: the path of the first specified Compose file)

GLOBAL FLAGS
  -D, --debug                           Enable debug logging
  -f, --file=<value>...                 [default: ] Compose configuration file
  -p, --project=<value>                 Project name. Defaults to the Compose project name
      --disable-plugin=<value>...       Disable plugin with specified package name
      --enable-plugin=<value>...        [default: @preevy/plugin-github] Enable plugin with specified package name
      --json                            Format output as json.
      --system-compose-file=<value>...  [default: ] Add extra Compose configuration file without overriding the defaults

DESCRIPTION
  View profile configuration
```

_See code: [src/commands/profile/config/view.ts](https://github.com/livecycle/preevy/blob/v0.0.60/src/commands/profile/config/view.ts)_

## `preevy profile cp`

Copy a profile

```
USAGE
  $ preevy profile cp [--json] [-D] [-f <value>] [--system-compose-file <value>] [--project-directory <value>]
    [-p <value>] [--enable-plugin <value>] [--disable-plugin <value>] [--profile <value>] [--target-location <value> |
    --target-storage local|s3|gs|azblob] [--target-name <value>] [--use]

FLAGS
  --profile=<value>            Source profile name, defaults to the current profile
  --project-directory=<value>  Alternate working directory (default: the path of the first specified Compose file)
  --target-location=<value>    Target profile location URL
  --target-name=<value>        Target profile name
  --target-storage=<option>    Target profile storage type
                               <options: local|s3|gs|azblob>
  --use                        Mark the new profile as the current profile

GLOBAL FLAGS
  -D, --debug                           Enable debug logging
  -f, --file=<value>...                 [default: ] Compose configuration file
  -p, --project=<value>                 Project name. Defaults to the Compose project name
      --disable-plugin=<value>...       Disable plugin with specified package name
      --enable-plugin=<value>...        [default: @preevy/plugin-github] Enable plugin with specified package name
      --json                            Format output as json.
      --system-compose-file=<value>...  [default: ] Add extra Compose configuration file without overriding the defaults

DESCRIPTION
  Copy a profile
```

_See code: [src/commands/profile/cp.ts](https://github.com/livecycle/preevy/blob/v0.0.60/src/commands/profile/cp.ts)_

## `preevy profile create NAME URL`

Create a new profile

```
USAGE
  $ preevy profile create NAME URL [--json] [-D] [-f <value>] [--system-compose-file <value>] [--project-directory
    <value>] [-p <value>] [--enable-plugin <value>] [--disable-plugin <value>] [--profile <value>] [--lightsail-region
    <value>] [--gce-project-id <value>] [--gce-zone <value>] [--azure-region <value>] [--azure-subscription-id <value>]
    [--kube-pod-namespace <value>] [--kube-pod-kubeconfig <value>] [--kube-pod-context <value>]
    [--lightsail-availability-zone <value>] [--lightsail-bundle-id
    nano_2_0|micro_2_0|small_2_0|medium_2_0|large_2_0|xlarge_2_0|2xlarge_2_0] [--gce-machine-type <value>]
    [--azure-vm-size <value>] [--kube-pod-template <value>] [--kube-pod-server-side-apply] [--kube-pod-storage-class
    <value>] [--kube-pod-storage-size <value>] [-d lightsail|gce|azure|kube-pod] [--use]

ARGUMENTS
  NAME  Name of the new profile
  URL   URL of the new profile

FLAGS
  -d, --driver=<option>            Machine driver to use
                                   <options: lightsail|gce|azure|kube-pod>
      --profile=<value>            Run in a specific profile context (either an alias or a URL)
      --project-directory=<value>  Alternate working directory (default: the path of the first specified Compose file)
      --use                        Mark the new profile as the current profile

GLOBAL FLAGS
  -D, --debug                           Enable debug logging
  -f, --file=<value>...                 [default: ] Compose configuration file
  -p, --project=<value>                 Project name. Defaults to the Compose project name
      --disable-plugin=<value>...       Disable plugin with specified package name
      --enable-plugin=<value>...        [default: @preevy/plugin-github] Enable plugin with specified package name
      --json                            Format output as json.
      --system-compose-file=<value>...  [default: ] Add extra Compose configuration file without overriding the defaults

AZURE DRIVER FLAGS
  --azure-region=<value>           Microsoft Azure region in which resources will be provisioned
  --azure-subscription-id=<value>  Microsoft Azure Subscription ID
  --azure-vm-size=<value>          [default: Standard_B2s] Machine type to be provisioned

GCE DRIVER FLAGS
  --gce-machine-type=<value>  Machine type to be provisioned
  --gce-project-id=<value>    Google Cloud project ID
  --gce-zone=<value>          Google Cloud zone in which resources will be provisioned

KUBE-POD DRIVER FLAGS
  --kube-pod-context=<value>         kubeconfig context name (will load config from defaults if not specified)
  --kube-pod-kubeconfig=<value>      Path to kubeconfig file (will load config from defaults if not specified)
  --kube-pod-namespace=<value>       [default: default] Kubernetes namespace in which resources will be provisioned
                                     (needs to exist)
  --[no-]kube-pod-server-side-apply  Use server side apply to create Kubernetes resources
  --kube-pod-storage-class=<value>   Storage class to use for Pod data volume
  --kube-pod-storage-size=<value>    [default: 5] Size of Pod data volume in GiB
  --kube-pod-template=<value>        Path to custom resources template file (will use default template if not specified)

LIGHTSAIL DRIVER FLAGS
  --lightsail-availability-zone=<value>  AWS availability zone to provision resources in region
  --lightsail-bundle-id=<option>         Lightsail bundle ID (size of instance) to provision. Default: medium_2_0
                                         <options:
                                         nano_2_0|micro_2_0|small_2_0|medium_2_0|large_2_0|xlarge_2_0|2xlarge_2_0>
  --lightsail-region=<value>             AWS region in which resources will be provisioned

DESCRIPTION
  Create a new profile
```

_See code: [src/commands/profile/create.ts](https://github.com/livecycle/preevy/blob/v0.0.60/src/commands/profile/create.ts)_

## `preevy profile current`

Display current profile in use

```
USAGE
  $ preevy profile current [--json] [-D] [-f <value>] [--system-compose-file <value>] [--project-directory <value>]
    [-p <value>] [--enable-plugin <value>] [--disable-plugin <value>] [--profile <value>]

FLAGS
  --profile=<value>            Run in a specific profile context (either an alias or a URL)
  --project-directory=<value>  Alternate working directory (default: the path of the first specified Compose file)

GLOBAL FLAGS
  -D, --debug                           Enable debug logging
  -f, --file=<value>...                 [default: ] Compose configuration file
  -p, --project=<value>                 Project name. Defaults to the Compose project name
      --disable-plugin=<value>...       Disable plugin with specified package name
      --enable-plugin=<value>...        [default: @preevy/plugin-github] Enable plugin with specified package name
      --json                            Format output as json.
      --system-compose-file=<value>...  [default: ] Add extra Compose configuration file without overriding the defaults

DESCRIPTION
  Display current profile in use
```

_See code: [src/commands/profile/current.ts](https://github.com/livecycle/preevy/blob/v0.0.60/src/commands/profile/current.ts)_

## `preevy profile import LOCATION`

Import an existing profile

```
USAGE
  $ preevy profile import LOCATION [-D] [-f <value>] [--system-compose-file <value>] [--project-directory <value>]
    [-p <value>] [--enable-plugin <value>] [--disable-plugin <value>] [--name <value>] [--use]

ARGUMENTS
  LOCATION  URL of the profile

FLAGS
  --name=<value>               Name of the profile
  --project-directory=<value>  Alternate working directory (default: the path of the first specified Compose file)
  --use                        Mark the new profile as the current profile

GLOBAL FLAGS
  -D, --debug                           Enable debug logging
  -f, --file=<value>...                 [default: ] Compose configuration file
  -p, --project=<value>                 Project name. Defaults to the Compose project name
      --disable-plugin=<value>...       Disable plugin with specified package name
      --enable-plugin=<value>...        [default: @preevy/plugin-github] Enable plugin with specified package name
      --system-compose-file=<value>...  [default: ] Add extra Compose configuration file without overriding the defaults

DESCRIPTION
  Import an existing profile
```

_See code: [src/commands/profile/import.ts](https://github.com/livecycle/preevy/blob/v0.0.60/src/commands/profile/import.ts)_

## `preevy profile key [TYPE]`

Show profile key

```
USAGE
  $ preevy profile key [TYPE] [--json] [-D] [-f <value>] [--system-compose-file <value>] [--project-directory
    <value>] [-p <value>] [--enable-plugin <value>] [--disable-plugin <value>] [--profile <value>]

ARGUMENTS
  TYPE  (private|public-pem|public-ssh|thumbprint|thumbprint-uri) [default: thumbprint-uri] type of the key to show

FLAGS
  --profile=<value>            Run in a specific profile context (either an alias or a URL)
  --project-directory=<value>  Alternate working directory (default: the path of the first specified Compose file)

GLOBAL FLAGS
  -D, --debug                           Enable debug logging
  -f, --file=<value>...                 [default: ] Compose configuration file
  -p, --project=<value>                 Project name. Defaults to the Compose project name
      --disable-plugin=<value>...       Disable plugin with specified package name
      --enable-plugin=<value>...        [default: @preevy/plugin-github] Enable plugin with specified package name
      --json                            Format output as json.
      --system-compose-file=<value>...  [default: ] Add extra Compose configuration file without overriding the defaults

DESCRIPTION
  Show profile key
```

_See code: [src/commands/profile/key.ts](https://github.com/livecycle/preevy/blob/v0.0.60/src/commands/profile/key.ts)_

## `preevy profile link`

Link the profile to the logged in user's organization

```
USAGE
  $ preevy profile link [-D] [-f <value>] [--system-compose-file <value>] [--project-directory <value>] [-p
    <value>] [--enable-plugin <value>] [--disable-plugin <value>] [--profile <value>] [--lc-api-url <value>]
    [--access-token <value>] [--org <value>]

FLAGS
  --access-token=<value>       Livecycle's Access Token
  --lc-api-url=<value>         [default: https://app.livecycle.run] The Livecycle API URL'
  --org=<value>                Target organization slug for linking the profile
  --profile=<value>            Run in a specific profile context (either an alias or a URL)
  --project-directory=<value>  Alternate working directory (default: the path of the first specified Compose file)

GLOBAL FLAGS
  -D, --debug                           Enable debug logging
  -f, --file=<value>...                 [default: ] Compose configuration file
  -p, --project=<value>                 Project name. Defaults to the Compose project name
      --disable-plugin=<value>...       Disable plugin with specified package name
      --enable-plugin=<value>...        [default: @preevy/plugin-github] Enable plugin with specified package name
      --system-compose-file=<value>...  [default: ] Add extra Compose configuration file without overriding the defaults

DESCRIPTION
  Link the profile to the logged in user's organization
```

_See code: [src/commands/profile/link.ts](https://github.com/livecycle/preevy/blob/v0.0.60/src/commands/profile/link.ts)_

## `preevy profile ls`

Lists profiles

```
USAGE
  $ preevy profile ls [--json] [-D] [-f <value>] [--system-compose-file <value>] [--project-directory <value>]
    [-p <value>] [--enable-plugin <value>] [--disable-plugin <value>] [--profile <value>] [--columns <value> | -x]
    [--filter <value>] [--no-header | [--csv | --no-truncate]] [--output csv|json|yaml |  | ] [--sort <value>]

FLAGS
  --json
  --profile=<value>            Run in a specific profile context (either an alias or a URL)
  --project-directory=<value>  Alternate working directory (default: the path of the first specified Compose file)

GLOBAL FLAGS
  -D, --debug                           Enable debug logging
  -f, --file=<value>...                 [default: ] Compose configuration file
  -p, --project=<value>                 Project name. Defaults to the Compose project name
      --disable-plugin=<value>...       Disable plugin with specified package name
      --enable-plugin=<value>...        [default: @preevy/plugin-github] Enable plugin with specified package name
      --system-compose-file=<value>...  [default: ] Add extra Compose configuration file without overriding the defaults

OUTPUT FLAGS
  -x, --extended         show extra columns
      --columns=<value>  only show provided columns (comma-separated)
      --csv              output is csv format [alias: --output=csv]
      --filter=<value>   filter property by partial string matching, ex: name=foo
      --no-header        hide table header from output
      --no-truncate      do not truncate output to fit screen
      --output=<option>  output in a more machine friendly format
                         <options: csv|json|yaml>
      --sort=<value>     property to sort by (prepend '-' for descending)

DESCRIPTION
  Lists profiles
```

_See code: [src/commands/profile/ls.ts](https://github.com/livecycle/preevy/blob/v0.0.60/src/commands/profile/ls.ts)_

## `preevy profile rm NAME`

Remove a profile

```
USAGE
  $ preevy profile rm NAME [--json] [-D] [-f <value>] [--system-compose-file <value>] [--project-directory
    <value>] [-p <value>] [--enable-plugin <value>] [--disable-plugin <value>] [--profile <value>] [--force]

ARGUMENTS
  NAME  name of the profile to remove

FLAGS
  --force                      Do not error if the profile is not found
  --profile=<value>            Run in a specific profile context (either an alias or a URL)
  --project-directory=<value>  Alternate working directory (default: the path of the first specified Compose file)

GLOBAL FLAGS
  -D, --debug                           Enable debug logging
  -f, --file=<value>...                 [default: ] Compose configuration file
  -p, --project=<value>                 Project name. Defaults to the Compose project name
      --disable-plugin=<value>...       Disable plugin with specified package name
      --enable-plugin=<value>...        [default: @preevy/plugin-github] Enable plugin with specified package name
      --json                            Format output as json.
      --system-compose-file=<value>...  [default: ] Add extra Compose configuration file without overriding the defaults

DESCRIPTION
  Remove a profile
```

_See code: [src/commands/profile/rm.ts](https://github.com/livecycle/preevy/blob/v0.0.60/src/commands/profile/rm.ts)_

## `preevy profile use NAME`

Set current profile

```
USAGE
  $ preevy profile use NAME [-D] [-f <value>] [--system-compose-file <value>] [--project-directory <value>] [-p
    <value>] [--enable-plugin <value>] [--disable-plugin <value>]

ARGUMENTS
  NAME  name of the profile to use

FLAGS
  --project-directory=<value>  Alternate working directory (default: the path of the first specified Compose file)

GLOBAL FLAGS
  -D, --debug                           Enable debug logging
  -f, --file=<value>...                 [default: ] Compose configuration file
  -p, --project=<value>                 Project name. Defaults to the Compose project name
      --disable-plugin=<value>...       Disable plugin with specified package name
      --enable-plugin=<value>...        [default: @preevy/plugin-github] Enable plugin with specified package name
      --system-compose-file=<value>...  [default: ] Add extra Compose configuration file without overriding the defaults

DESCRIPTION
  Set current profile
```

_See code: [src/commands/profile/use.ts](https://github.com/livecycle/preevy/blob/v0.0.60/src/commands/profile/use.ts)_
