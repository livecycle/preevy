Preevy CLI
=================

[![Version](https://img.shields.io/npm/v/preevy.svg)](https://npmjs.org/package/preevy)
[![Downloads/week](https://img.shields.io/npm/dw/preevy.svg)](https://npmjs.org/package/preevy)
[![License](https://img.shields.io/npm/l/preevy.svg)](https://github.com/livecycle/preevy/blob/main/LICENSE)

Preevy is a CLI tool for easily creating preview environments for your Docker Compose apps on your cloud provider - we currently support AWS and Google, with more on the way.


<!-- toc -->
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->
# Usage
<!-- usage -->
```sh-session
$ npm install -g preevy
$ preevy COMMAND
running command...
$ preevy (--version)
preevy/0.0.57 darwin-arm64 node-v18.12.1
$ preevy --help [COMMAND]
USAGE
  $ preevy COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`preevy down`](#preevy-down)
* [`preevy help [COMMANDS]`](#preevy-help-commands)
* [`preevy init [PROFILE-ALIAS]`](#preevy-init-profile-alias)
* [`preevy login`](#preevy-login)
* [`preevy logs [SERVICES]`](#preevy-logs-services)
* [`preevy ls`](#preevy-ls)
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
* [`preevy purge`](#preevy-purge)
* [`preevy ssh ENVID`](#preevy-ssh-envid)
* [`preevy up [SERVICE]`](#preevy-up-service)
* [`preevy urls [SERVICE] [PORT]`](#preevy-urls-service-port)
* [`preevy version`](#preevy-version)

## `preevy down`

Delete preview environments

```
USAGE
  $ preevy down [--json] [-D] [-f <value>] [--system-compose-file <value>] [-p <value>] [--enable-plugin
    <value>] [--disable-plugin <value>] [--profile <value>] [-d lightsail|gce|azure|kube-pod] [--lightsail-region
    <value>] [--gce-project-id <value>] [--gce-zone <value>] [--azure-region <value>] [--azure-subscription-id <value>]
    [--kube-pod-namespace <value>] [--kube-pod-kubeconfig <value>] [--kube-pod-context <value>] [--kube-pod-template
    <value>] [--id <value>] [--force] [--wait] [--github-token <value>] [--github-repo <value>] [--github-pull-request
    <value>] [--github-pr-comment-template-file <value>] [--github-add-build-cache] [--github-pr-comment-enabled
    auto|no|always]

FLAGS
  -d, --driver=<option>  Machine driver to use
                         <options: lightsail|gce|azure|kube-pod>
      --force            Do not error if the environment is not found
      --id=<value>       Environment id
      --profile=<value>  Run in a specific profile context
      --wait             Wait for resource deletion to complete. If false (the default), the deletion will be started
                         but not waited for

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
  --azure-subscription-id=<value>  Microsoft Azure subscription id

GCE DRIVER FLAGS
  --gce-project-id=<value>  Google Cloud project ID
  --gce-zone=<value>        Google Cloud zone in which resources will be provisioned

GITHUB INTEGRATION FLAGS
  --github-add-build-cache                   Add github cache to the build
  --github-pr-comment-enabled=<option>       [default: auto] Whether to enable posting to the GitHub PR
                                             <options: auto|no|always>
  --github-pr-comment-template-file=<value>  Path to nunjucks template file
  --github-pull-request=<value>              GitHub Pull Request number. Will auto-detect if not specified
  --github-repo=<value>                      GitHub repo name in the format owner/repo. Will auto-detect if not
                                             specified
  --github-token=<value>                     GitHub token with write access to the repo

KUBE-POD DRIVER FLAGS
  --kube-pod-context=<value>     kubeconfig context name (will load config from defaults if not specified)
  --kube-pod-kubeconfig=<value>  Path to kubeconfig file (will load config from defaults if not specified)
  --kube-pod-namespace=<value>   [default: default] Kubernetes namespace in which resources will be provisioned (needs
                                 to exist)
  --kube-pod-template=<value>    Path to custom resources template file (will use default template if not specified)

LIGHTSAIL DRIVER FLAGS
  --lightsail-region=<value>  AWS region in which resources will be provisioned

DESCRIPTION
  Delete preview environments

FLAG DESCRIPTIONS
  --id=<value>  Environment id

    Affects created URLs
    If not specified, will detect from the current Git context
```

_See code: [src/commands/down.ts](https://github.com/livecycle/preevy/blob/v0.0.57/src/commands/down.ts)_

## `preevy help [COMMANDS]`

Display help for preevy.

```
USAGE
  $ preevy help [COMMANDS] [-n]

ARGUMENTS
  COMMANDS  Command to show help for.

FLAGS
  -n, --nested-commands  Include all nested commands in the output.

DESCRIPTION
  Display help for preevy.
```

_See code: [src/commands/help.ts](https://github.com/livecycle/preevy/blob/v0.0.57/src/commands/help.ts)_

## `preevy init [PROFILE-ALIAS]`

Initialize or import a new profile

```
USAGE
  $ preevy init [PROFILE-ALIAS] [-D] [-f <value>] [--system-compose-file <value>] [-p <value>]
    [--enable-plugin <value>] [--disable-plugin <value>] [-f <value>]

ARGUMENTS
  PROFILE-ALIAS  [default: default] Alias of the profile

FLAGS
  -f, --from=<value>  Import profile from existing path

GLOBAL FLAGS
  -D, --debug                           Enable debug logging
  -f, --file=<value>...                 [default: ] Compose configuration file
  -p, --project=<value>                 Project name. Defaults to the Compose project name
      --disable-plugin=<value>...       Disable plugin with specified package name
      --enable-plugin=<value>...        [default: @preevy/plugin-github] Enable plugin with specified package name
      --system-compose-file=<value>...  [default: ] Add extra Compose configuration file without overriding the defaults

DESCRIPTION
  Initialize or import a new profile
```

_See code: [src/commands/init.ts](https://github.com/livecycle/preevy/blob/v0.0.57/src/commands/init.ts)_

## `preevy login`

Login to the Livecycle SaaS

```
USAGE
  $ preevy login [-D] [-f <value>] [--system-compose-file <value>] [-p <value>] [--enable-plugin <value>]
    [--disable-plugin <value>] [--lc-auth-url <value>] [--lc-api-url <value>] [--lc-client-id <value>]

FLAGS
  --lc-api-url=<value>    [default: https://app.livecycle.run] The Livecycle API URL'
  --lc-auth-url=<value>   [default: https://auth.livecycle.dev] The login URL
  --lc-client-id=<value>  [default: BHXcVtapfKPEpZtYO3AJ2Livmz6j7xK0] The client ID for the OAuth app

GLOBAL FLAGS
  -D, --debug                           Enable debug logging
  -f, --file=<value>...                 [default: ] Compose configuration file
  -p, --project=<value>                 Project name. Defaults to the Compose project name
      --disable-plugin=<value>...       Disable plugin with specified package name
      --enable-plugin=<value>...        [default: @preevy/plugin-github] Enable plugin with specified package name
      --system-compose-file=<value>...  [default: ] Add extra Compose configuration file without overriding the defaults

DESCRIPTION
  Login to the Livecycle SaaS
```

_See code: [src/commands/login.ts](https://github.com/livecycle/preevy/blob/v0.0.57/src/commands/login.ts)_

## `preevy logs [SERVICES]`

Show logs for an existing environment

```
USAGE
  $ preevy logs [SERVICES] [-D] [-f <value>] [--system-compose-file <value>] [-p <value>] [--enable-plugin
    <value>] [--disable-plugin <value>] [--profile <value>] [-d lightsail|gce|azure|kube-pod] [--lightsail-region
    <value>] [--gce-project-id <value>] [--gce-zone <value>] [--azure-region <value>] [--azure-subscription-id <value>]
    [--kube-pod-namespace <value>] [--kube-pod-kubeconfig <value>] [--kube-pod-context <value>] [--kube-pod-template
    <value>] [--id <value>] [--follow] [--tail <value>] [--no-log-prefix] [--timestamps] [--since <value>] [--until
    <value>]

ARGUMENTS
  SERVICES  Service name(s). If not specified, will show all services

FLAGS
  -d, --driver=<option>  Machine driver to use
                         <options: lightsail|gce|azure|kube-pod>
      --follow           Follow log output
      --id=<value>       Environment id
      --no-log-prefix    Don't print log prefix in logs
      --profile=<value>  Run in a specific profile context
      --since=<value>    Show logs since timestamp
      --tail=<value>     Number of lines to show from the end of the logs for each container (default: all)
      --timestamps       Show timestamps
      --until=<value>    Show logs before timestamp

GLOBAL FLAGS
  -D, --debug                           Enable debug logging
  -f, --file=<value>...                 [default: ] Compose configuration file
  -p, --project=<value>                 Project name. Defaults to the Compose project name
      --disable-plugin=<value>...       Disable plugin with specified package name
      --enable-plugin=<value>...        [default: @preevy/plugin-github] Enable plugin with specified package name
      --system-compose-file=<value>...  [default: ] Add extra Compose configuration file without overriding the defaults

AZURE DRIVER FLAGS
  --azure-region=<value>           Microsoft Azure region in which resources will be provisioned
  --azure-subscription-id=<value>  Microsoft Azure subscription id

GCE DRIVER FLAGS
  --gce-project-id=<value>  Google Cloud project ID
  --gce-zone=<value>        Google Cloud zone in which resources will be provisioned

KUBE-POD DRIVER FLAGS
  --kube-pod-context=<value>     kubeconfig context name (will load config from defaults if not specified)
  --kube-pod-kubeconfig=<value>  Path to kubeconfig file (will load config from defaults if not specified)
  --kube-pod-namespace=<value>   [default: default] Kubernetes namespace in which resources will be provisioned (needs
                                 to exist)
  --kube-pod-template=<value>    Path to custom resources template file (will use default template if not specified)

LIGHTSAIL DRIVER FLAGS
  --lightsail-region=<value>  AWS region in which resources will be provisioned

DESCRIPTION
  Show logs for an existing environment

FLAG DESCRIPTIONS
  --id=<value>  Environment id

    Affects created URLs
    If not specified, will detect from the current Git context
```

_See code: [src/commands/logs.ts](https://github.com/livecycle/preevy/blob/v0.0.57/src/commands/logs.ts)_

## `preevy ls`

List preview environments

```
USAGE
  $ preevy ls [--json] [-D] [-f <value>] [--system-compose-file <value>] [-p <value>] [--enable-plugin
    <value>] [--disable-plugin <value>] [--profile <value>] [-d lightsail|gce|azure|kube-pod] [--lightsail-region
    <value>] [--gce-project-id <value>] [--gce-zone <value>] [--azure-region <value>] [--azure-subscription-id <value>]
    [--kube-pod-namespace <value>] [--kube-pod-kubeconfig <value>] [--kube-pod-context <value>] [--kube-pod-template
    <value>] [--columns <value> | -x] [--filter <value>] [--no-header | [--csv | --no-truncate]] [--output csv|json|yaml
    |  | ] [--sort <value>]

FLAGS
  -d, --driver=<option>  Machine driver to use
                         <options: lightsail|gce|azure|kube-pod>
      --profile=<value>  Run in a specific profile context

GLOBAL FLAGS
  -D, --debug                           Enable debug logging
  -f, --file=<value>...                 [default: ] Compose configuration file
  -p, --project=<value>                 Project name. Defaults to the Compose project name
      --disable-plugin=<value>...       Disable plugin with specified package name
      --enable-plugin=<value>...        [default: @preevy/plugin-github] Enable plugin with specified package name
      --json                            Format output as json.
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

AZURE DRIVER FLAGS
  --azure-region=<value>           Microsoft Azure region in which resources will be provisioned
  --azure-subscription-id=<value>  Microsoft Azure subscription id

GCE DRIVER FLAGS
  --gce-project-id=<value>  Google Cloud project ID
  --gce-zone=<value>        Google Cloud zone in which resources will be provisioned

KUBE-POD DRIVER FLAGS
  --kube-pod-context=<value>     kubeconfig context name (will load config from defaults if not specified)
  --kube-pod-kubeconfig=<value>  Path to kubeconfig file (will load config from defaults if not specified)
  --kube-pod-namespace=<value>   [default: default] Kubernetes namespace in which resources will be provisioned (needs
                                 to exist)
  --kube-pod-template=<value>    Path to custom resources template file (will use default template if not specified)

LIGHTSAIL DRIVER FLAGS
  --lightsail-region=<value>  AWS region in which resources will be provisioned

DESCRIPTION
  List preview environments
```

_See code: [src/commands/ls.ts](https://github.com/livecycle/preevy/blob/v0.0.57/src/commands/ls.ts)_

## `preevy profile config update`

View and update profile configuration

```
USAGE
  $ preevy profile config update [--json] [-D] [-f <value>] [--system-compose-file <value>] [-p <value>] [--enable-plugin
    <value>] [--disable-plugin <value>] [--profile <value>] [--lightsail-region <value>] [--gce-project-id <value>]
    [--gce-zone <value>] [--azure-region <value>] [--azure-subscription-id <value>] [--kube-pod-namespace <value>]
    [--kube-pod-kubeconfig <value>] [--kube-pod-context <value>] [--kube-pod-template <value>]
    [--lightsail-availability-zone <value>] [--lightsail-bundle-id
    nano_2_0|micro_2_0|small_2_0|medium_2_0|large_2_0|xlarge_2_0|2xlarge_2_0] [--gce-machine-type <value>]
    [--azure-vm-size <value>] [--kube-pod-server-side-apply] [-d lightsail|gce|azure|kube-pod] [--unset
    lightsail-region|gce-project-id|gce-zone|azure-region|azure-subscription-id|kube-pod-namespace|kube-pod-kubeconfig|k
    ube-pod-context|kube-pod-template|lightsail-availability-zone|lightsail-bundle-id|gce-machine-type|azure-vm-size|kub
    e-pod-server-side-apply]

FLAGS
  -d, --driver=<option>    Machine driver to use
                           <options: lightsail|gce|azure|kube-pod>
      --profile=<value>    Run in a specific profile context
      --unset=<option>...  [default: ] Unset a configuration option
                           <options: lightsail-region|gce-project-id|gce-zone|azure-region|azure-subscription-id|kube-po
                           d-namespace|kube-pod-kubeconfig|kube-pod-context|kube-pod-template|lightsail-availability-zon
                           e|lightsail-bundle-id|gce-machine-type|azure-vm-size|kube-pod-server-side-apply>

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
  --azure-subscription-id=<value>  Microsoft Azure subscription id
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

_See code: [src/commands/profile/config/update.ts](https://github.com/livecycle/preevy/blob/v0.0.57/src/commands/profile/config/update.ts)_

## `preevy profile config view`

View profile configuration

```
USAGE
  $ preevy profile config view [--json] [-D] [-f <value>] [--system-compose-file <value>] [-p <value>] [--enable-plugin
    <value>] [--disable-plugin <value>] [--profile <value>]

FLAGS
  --profile=<value>  Run in a specific profile context

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

_See code: [src/commands/profile/config/view.ts](https://github.com/livecycle/preevy/blob/v0.0.57/src/commands/profile/config/view.ts)_

## `preevy profile cp`

Copy a profile

```
USAGE
  $ preevy profile cp [--json] [-D] [-f <value>] [--system-compose-file <value>] [-p <value>] [--enable-plugin
    <value>] [--disable-plugin <value>] [--profile <value>] [--target-location <value> | --target-storage local|s3|gs]
    [--target-name <value>] [--use]

FLAGS
  --profile=<value>          Source profile name, defaults to the current profile
  --target-location=<value>  Target profile location URL
  --target-name=<value>      Target profile name
  --target-storage=<option>  Target profile storage type
                             <options: local|s3|gs>
  --use                      Mark the new profile as the current profile

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

_See code: [src/commands/profile/cp.ts](https://github.com/livecycle/preevy/blob/v0.0.57/src/commands/profile/cp.ts)_

## `preevy profile create NAME URL`

Create a new profile

```
USAGE
  $ preevy profile create NAME URL [--json] [-D] [-f <value>] [--system-compose-file <value>] [-p <value>]
    [--enable-plugin <value>] [--disable-plugin <value>] [--profile <value>] [--lightsail-region <value>]
    [--gce-project-id <value>] [--gce-zone <value>] [--azure-region <value>] [--azure-subscription-id <value>]
    [--kube-pod-namespace <value>] [--kube-pod-kubeconfig <value>] [--kube-pod-context <value>] [--kube-pod-template
    <value>] [--lightsail-availability-zone <value>] [--lightsail-bundle-id
    nano_2_0|micro_2_0|small_2_0|medium_2_0|large_2_0|xlarge_2_0|2xlarge_2_0] [--gce-machine-type <value>]
    [--azure-vm-size <value>] [--kube-pod-server-side-apply] [-d lightsail|gce|azure|kube-pod] [--use]

ARGUMENTS
  NAME  Name of the new profile
  URL   URL of the new profile

FLAGS
  -d, --driver=<option>  Machine driver to use
                         <options: lightsail|gce|azure|kube-pod>
      --profile=<value>  Run in a specific profile context
      --use              Mark the new profile as the current profile

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
  --azure-subscription-id=<value>  Microsoft Azure subscription id
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

_See code: [src/commands/profile/create.ts](https://github.com/livecycle/preevy/blob/v0.0.57/src/commands/profile/create.ts)_

## `preevy profile current`

Display current profile in use

```
USAGE
  $ preevy profile current [--json] [-D] [-f <value>] [--system-compose-file <value>] [-p <value>] [--enable-plugin
    <value>] [--disable-plugin <value>] [--profile <value>]

FLAGS
  --profile=<value>  Run in a specific profile context

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

_See code: [src/commands/profile/current.ts](https://github.com/livecycle/preevy/blob/v0.0.57/src/commands/profile/current.ts)_

## `preevy profile import LOCATION`

Import an existing profile

```
USAGE
  $ preevy profile import LOCATION [-D] [-f <value>] [--system-compose-file <value>] [-p <value>] [--enable-plugin
    <value>] [--disable-plugin <value>] [--name <value>] [--use]

ARGUMENTS
  LOCATION  URL of the profile

FLAGS
  --name=<value>  Name of the profile
  --use           Mark the new profile as the current profile

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

_See code: [src/commands/profile/import.ts](https://github.com/livecycle/preevy/blob/v0.0.57/src/commands/profile/import.ts)_

## `preevy profile key [TYPE]`

Show profile key

```
USAGE
  $ preevy profile key [TYPE] [--json] [-D] [-f <value>] [--system-compose-file <value>] [-p <value>]
    [--enable-plugin <value>] [--disable-plugin <value>] [--profile <value>]

ARGUMENTS
  TYPE  (private|public-pem|public-ssh|thumbprint|thumbprint-uri) [default: thumbprint-uri] type of the key to show

FLAGS
  --profile=<value>  Run in a specific profile context

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

_See code: [src/commands/profile/key.ts](https://github.com/livecycle/preevy/blob/v0.0.57/src/commands/profile/key.ts)_

## `preevy profile link`

Link the profile to the logged in user's organization

```
USAGE
  $ preevy profile link [-D] [-f <value>] [--system-compose-file <value>] [-p <value>] [--enable-plugin <value>]
    [--disable-plugin <value>] [--profile <value>] [--lc-api-url <value>] [--access-token <value>] [--org <value>]

FLAGS
  --access-token=<value>  Livecycle's Access Token
  --lc-api-url=<value>    [default: https://app.livecycle.run] The Livecycle API URL'
  --org=<value>           Target organization slug for linking the profile
  --profile=<value>       Run in a specific profile context

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

_See code: [src/commands/profile/link.ts](https://github.com/livecycle/preevy/blob/v0.0.57/src/commands/profile/link.ts)_

## `preevy profile ls`

Lists profiles

```
USAGE
  $ preevy profile ls [--json] [-D] [-f <value>] [--system-compose-file <value>] [-p <value>] [--enable-plugin
    <value>] [--disable-plugin <value>] [--profile <value>]

FLAGS
  --profile=<value>  Run in a specific profile context

GLOBAL FLAGS
  -D, --debug                           Enable debug logging
  -f, --file=<value>...                 [default: ] Compose configuration file
  -p, --project=<value>                 Project name. Defaults to the Compose project name
      --disable-plugin=<value>...       Disable plugin with specified package name
      --enable-plugin=<value>...        [default: @preevy/plugin-github] Enable plugin with specified package name
      --json                            Format output as json.
      --system-compose-file=<value>...  [default: ] Add extra Compose configuration file without overriding the defaults

DESCRIPTION
  Lists profiles
```

_See code: [src/commands/profile/ls.ts](https://github.com/livecycle/preevy/blob/v0.0.57/src/commands/profile/ls.ts)_

## `preevy profile rm NAME`

Remove a profile

```
USAGE
  $ preevy profile rm NAME [--json] [-D] [-f <value>] [--system-compose-file <value>] [-p <value>]
    [--enable-plugin <value>] [--disable-plugin <value>] [--profile <value>]

ARGUMENTS
  NAME  name of the profile to remove

FLAGS
  --profile=<value>  Run in a specific profile context

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

_See code: [src/commands/profile/rm.ts](https://github.com/livecycle/preevy/blob/v0.0.57/src/commands/profile/rm.ts)_

## `preevy profile use NAME`

Set current profile

```
USAGE
  $ preevy profile use NAME [-D] [-f <value>] [--system-compose-file <value>] [-p <value>] [--enable-plugin
    <value>] [--disable-plugin <value>]

ARGUMENTS
  NAME  name of the profile to use

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

_See code: [src/commands/profile/use.ts](https://github.com/livecycle/preevy/blob/v0.0.57/src/commands/profile/use.ts)_

## `preevy purge`

Delete all cloud provider machines, and potentially other resources

```
USAGE
  $ preevy purge [--json] [-D] [-f <value>] [--system-compose-file <value>] [-p <value>] [--enable-plugin
    <value>] [--disable-plugin <value>] [--profile <value>] [-d lightsail|gce|azure|kube-pod] [--lightsail-region
    <value>] [--gce-project-id <value>] [--gce-zone <value>] [--azure-region <value>] [--azure-subscription-id <value>]
    [--kube-pod-namespace <value>] [--kube-pod-kubeconfig <value>] [--kube-pod-context <value>] [--kube-pod-template
    <value>] [--all] [--type <value>] [--force] [--wait]

FLAGS
  -d, --driver=<option>  Machine driver to use
                         <options: lightsail|gce|azure|kube-pod>
      --all              Remove all resources types (snapshots, keypairs, and other resource types)
      --force            Do not ask for confirmation
      --profile=<value>  Run in a specific profile context
      --type=<value>...  [default: machine] Resource type(s) to delete
      --wait             Wait for resource deletion to complete. If false (the default), the deletion will be started
                         but not waited for

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
  --azure-subscription-id=<value>  Microsoft Azure subscription id

GCE DRIVER FLAGS
  --gce-project-id=<value>  Google Cloud project ID
  --gce-zone=<value>        Google Cloud zone in which resources will be provisioned

KUBE-POD DRIVER FLAGS
  --kube-pod-context=<value>     kubeconfig context name (will load config from defaults if not specified)
  --kube-pod-kubeconfig=<value>  Path to kubeconfig file (will load config from defaults if not specified)
  --kube-pod-namespace=<value>   [default: default] Kubernetes namespace in which resources will be provisioned (needs
                                 to exist)
  --kube-pod-template=<value>    Path to custom resources template file (will use default template if not specified)

LIGHTSAIL DRIVER FLAGS
  --lightsail-region=<value>  AWS region in which resources will be provisioned

DESCRIPTION
  Delete all cloud provider machines, and potentially other resources
```

_See code: [src/commands/purge.ts](https://github.com/livecycle/preevy/blob/v0.0.57/src/commands/purge.ts)_

## `preevy ssh ENVID`

Execute a command or start an interactive shell inside an environment

```
USAGE
  $ preevy ssh ENVID [-D] [-f <value>] [--system-compose-file <value>] [-p <value>] [--enable-plugin
    <value>] [--disable-plugin <value>] [--profile <value>] [-d lightsail|gce|azure|kube-pod] [--lightsail-region
    <value>] [--gce-project-id <value>] [--gce-zone <value>] [--azure-region <value>] [--azure-subscription-id <value>]
    [--kube-pod-namespace <value>] [--kube-pod-kubeconfig <value>] [--kube-pod-context <value>] [--kube-pod-template
    <value>]

ARGUMENTS
  ENVID  Environment id

FLAGS
  -d, --driver=<option>  Machine driver to use
                         <options: lightsail|gce|azure|kube-pod>
      --profile=<value>  Run in a specific profile context

GLOBAL FLAGS
  -D, --debug                           Enable debug logging
  -f, --file=<value>...                 [default: ] Compose configuration file
  -p, --project=<value>                 Project name. Defaults to the Compose project name
      --disable-plugin=<value>...       Disable plugin with specified package name
      --enable-plugin=<value>...        [default: @preevy/plugin-github] Enable plugin with specified package name
      --system-compose-file=<value>...  [default: ] Add extra Compose configuration file without overriding the defaults

AZURE DRIVER FLAGS
  --azure-region=<value>           Microsoft Azure region in which resources will be provisioned
  --azure-subscription-id=<value>  Microsoft Azure subscription id

GCE DRIVER FLAGS
  --gce-project-id=<value>  Google Cloud project ID
  --gce-zone=<value>        Google Cloud zone in which resources will be provisioned

KUBE-POD DRIVER FLAGS
  --kube-pod-context=<value>     kubeconfig context name (will load config from defaults if not specified)
  --kube-pod-kubeconfig=<value>  Path to kubeconfig file (will load config from defaults if not specified)
  --kube-pod-namespace=<value>   [default: default] Kubernetes namespace in which resources will be provisioned (needs
                                 to exist)
  --kube-pod-template=<value>    Path to custom resources template file (will use default template if not specified)

LIGHTSAIL DRIVER FLAGS
  --lightsail-region=<value>  AWS region in which resources will be provisioned

DESCRIPTION
  Execute a command or start an interactive shell inside an environment

ALIASES
  $ preevy ssh
```

## `preevy up [SERVICE]`

Bring up a preview environment

```
USAGE
  $ preevy up [SERVICE] (--access-credentials-type api|browser --include-access-credentials) [-D] [-f
    <value>] [--system-compose-file <value>] [-p <value>] [--enable-plugin <value>] [--disable-plugin <value>]
    [--profile <value>] [-d lightsail|gce|azure|kube-pod] [--lightsail-region <value>] [--gce-project-id <value>]
    [--gce-zone <value>] [--azure-region <value>] [--azure-subscription-id <value>] [--kube-pod-namespace <value>]
    [--kube-pod-kubeconfig <value>] [--kube-pod-context <value>] [--kube-pod-template <value>]
    [--lightsail-availability-zone <value>] [--lightsail-bundle-id
    nano_2_0|micro_2_0|small_2_0|medium_2_0|large_2_0|xlarge_2_0|2xlarge_2_0] [--gce-machine-type <value>]
    [--azure-vm-size <value>] [--kube-pod-server-side-apply] [--id <value>] [-t <value>] [--tls-hostname <value>]
    [--insecure-skip-verify] [--no-build] [--no-registry-single-name | [--registry-single-name <value> --registry
    <value>]] [--no-registry-cache ] [--builder <value>] [--no-cache] [--skip-unchanged-files]
    [--show-preevy-service-urls] [--output-urls-to <value>] [--columns <value> | -x] [--filter <value>] [--no-header |
    [--csv | --no-truncate]] [--output csv|json|yaml |  | ] [--sort <value>] [--github-token <value>] [--github-repo
    <value>] [--github-pull-request <value>] [--github-pr-comment-template-file <value>] [--github-add-build-cache]
    [--github-pr-comment-enabled auto|no|always]

ARGUMENTS
  SERVICE  Service name(s). If not specified, will deploy all services

FLAGS
  -d, --driver=<option>                   Machine driver to use
                                          <options: lightsail|gce|azure|kube-pod>
  -t, --tunnel-url=<value>                [default: ssh+tls://livecycle.run] Tunnel url, specify ssh://hostname[:port]
                                          or ssh+tls://hostname[:port]
      --access-credentials-type=<option>  (required) [default: browser] Access credentials type
                                          <options: api|browser>
      --id=<value>                        Environment id
      --include-access-credentials        Include access credentials for basic auth for each service URL
      --insecure-skip-verify              Skip TLS or SSH certificate verification
      --output-urls-to=<value>            Output URLs to file
      --profile=<value>                   Run in a specific profile context
      --show-preevy-service-urls          Show URLs for internal Preevy services
      --[no-]skip-unchanged-files         Detect and skip unchanged files when copying (default: true)
      --tls-hostname=<value>              Override TLS server name when tunneling via HTTPS

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

AZURE DRIVER FLAGS
  --azure-region=<value>           Microsoft Azure region in which resources will be provisioned
  --azure-subscription-id=<value>  Microsoft Azure subscription id
  --azure-vm-size=<value>          [default: Standard_B2s] Machine type to be provisioned

BUILD FLAGS
  --builder=<value>               Builder to use
  --no-build                      Do not build images
  --no-cache                      Do not use cache when building the images
  --no-registry-cache             Do not add the registry as a cache source and target
  --no-registry-single-name       Disable auto-detection for ECR-style registry single name
  --registry=<value>              Image registry. If this flag is specified, the "build-context" flag defaults to
                                  "*local"
  --registry-single-name=<value>  Use single name for image registry, ECR-style. Default: auto-detect from "registry"
                                  flag

GCE DRIVER FLAGS
  --gce-machine-type=<value>  Machine type to be provisioned
  --gce-project-id=<value>    Google Cloud project ID
  --gce-zone=<value>          Google Cloud zone in which resources will be provisioned

GITHUB INTEGRATION FLAGS
  --github-add-build-cache                   Add github cache to the build
  --github-pr-comment-enabled=<option>       [default: auto] Whether to enable posting to the GitHub PR
                                             <options: auto|no|always>
  --github-pr-comment-template-file=<value>  Path to nunjucks template file
  --github-pull-request=<value>              GitHub Pull Request number. Will auto-detect if not specified
  --github-repo=<value>                      GitHub repo name in the format owner/repo. Will auto-detect if not
                                             specified
  --github-token=<value>                     GitHub token with write access to the repo

KUBE-POD DRIVER FLAGS
  --kube-pod-context=<value>         kubeconfig context name (will load config from defaults if not specified)
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
  --lightsail-region=<value>             AWS region in which resources will be provisioned

DESCRIPTION
  Bring up a preview environment

FLAG DESCRIPTIONS
  --id=<value>  Environment id

    Affects created URLs
    If not specified, will detect from the current Git context
```

_See code: [src/commands/up.ts](https://github.com/livecycle/preevy/blob/v0.0.57/src/commands/up.ts)_

## `preevy urls [SERVICE] [PORT]`

Show urls for an existing environment

```
USAGE
  $ preevy urls [SERVICE] [PORT] (--access-credentials-type api|browser --include-access-credentials)
    [--json] [-D] [-f <value>] [--system-compose-file <value>] [-p <value>] [--enable-plugin <value>] [--disable-plugin
    <value>] [--profile <value>] [--id <value>] [-t <value>] [--tls-hostname <value>] [--insecure-skip-verify]
    [--columns <value> | -x] [--filter <value>] [--no-header | [--csv | --no-truncate]] [--output csv|json|yaml |  | ]
    [--sort <value>] [--show-preevy-service-] [--output-urls-to <value>]

ARGUMENTS
  SERVICE  Service name. If not specified, will show all services
  PORT     Service port. If not specified, will show all ports for the specified service

FLAGS
  -t, --tunnel-url=<value>                [default: ssh+tls://livecycle.run] Tunnel url, specify ssh://hostname[:port]
                                          or ssh+tls://hostname[:port]
      --access-credentials-type=<option>  (required) [default: browser] Access credentials type
                                          <options: api|browser>
      --id=<value>                        Environment id
      --include-access-credentials        Include access credentials for basic auth for each service URL
      --insecure-skip-verify              Skip TLS or SSH certificate verification
      --output-urls-to=<value>            Output URLs to file
      --profile=<value>                   Run in a specific profile context
      --show-preevy-service-urls          Show URLs for internal Preevy services
      --tls-hostname=<value>              Override TLS server name when tunneling via HTTPS

GLOBAL FLAGS
  -D, --debug                           Enable debug logging
  -f, --file=<value>...                 [default: ] Compose configuration file
  -p, --project=<value>                 Project name. Defaults to the Compose project name
      --disable-plugin=<value>...       Disable plugin with specified package name
      --enable-plugin=<value>...        [default: @preevy/plugin-github] Enable plugin with specified package name
      --json                            Format output as json.
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
  Show urls for an existing environment

FLAG DESCRIPTIONS
  --id=<value>  Environment id

    Affects created URLs
    If not specified, will detect from the current Git context
```

_See code: [src/commands/urls.ts](https://github.com/livecycle/preevy/blob/v0.0.57/src/commands/urls.ts)_

## `preevy version`

Show Preevy version

```
USAGE
  $ preevy version [--json] [-D] [-f <value>] [--system-compose-file <value>] [-p <value>] [--enable-plugin
    <value>] [--disable-plugin <value>]

GLOBAL FLAGS
  -D, --debug                           Enable debug logging
  -f, --file=<value>...                 [default: ] Compose configuration file
  -p, --project=<value>                 Project name. Defaults to the Compose project name
      --disable-plugin=<value>...       Disable plugin with specified package name
      --enable-plugin=<value>...        [default: @preevy/plugin-github] Enable plugin with specified package name
      --json                            Format output as json.
      --system-compose-file=<value>...  [default: ] Add extra Compose configuration file without overriding the defaults

DESCRIPTION
  Show Preevy version
```

_See code: [src/commands/version.ts](https://github.com/livecycle/preevy/blob/v0.0.57/src/commands/version.ts)_
<!-- commandsstop -->
