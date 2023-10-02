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
preevy/0.0.52 darwin-arm64 node-v18.17.1
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
* [`preevy profile create NAME URL`](#preevy-profile-create-name-url)
* [`preevy profile current`](#preevy-profile-current)
* [`preevy profile import LOCATION`](#preevy-profile-import-location)
* [`preevy profile key [TYPE]`](#preevy-profile-key-type)
* [`preevy profile link`](#preevy-profile-link)
* [`preevy profile ls`](#preevy-profile-ls)
* [`preevy profile rm NAME`](#preevy-profile-rm-name)
* [`preevy profile use NAME`](#preevy-profile-use-name)
* [`preevy purge`](#preevy-purge)
* [`preevy up [SERVICE]`](#preevy-up-service)
* [`preevy urls [SERVICE] [PORT]`](#preevy-urls-service-port)
* [`preevy version`](#preevy-version)

## `preevy down`

Delete preview environments

```
USAGE
  $ preevy down [-D] [-f <value>] [--system-compose-file <value>] [-p <value>] [--profile <value>] [-d
    lightsail|gce|azure|kube-pod] [--lightsail-region us-east-2|us-east-1|us-west-2|ap-south-1|ap-northeast-2|ap-southea
    st-1|ap-southeast-2|ap-northeast-1|ca-central-1|eu-central-1|eu-west-1|eu-west-2|eu-west-3|eu-north-1]
    [--gce-project-id <value>] [--gce-zone <value>] [--azure-region <value>] [--azure-subscription-id <value>]
    [--kube-pod-namespace <value>] [--kube-pod-kubeconfig <value>] [--kube-pod-context <value>] [--kube-pod-template
    <value>] [--id <value>] [--force] [--wait] [--json]

FLAGS
  -d, --driver=<option>  Machine driver to use
                         <options: lightsail|gce|azure|kube-pod>
  --force                Do not error if the environment is not found
  --id=<value>           Environment id - affects created URLs. If not specified, will try to detect automatically
  --profile=<value>      Run in a specific profile context
  --wait                 Wait for resource deletion to complete. If false (the default), the deletion will be started
                         but not waited for

GLOBAL FLAGS
  -D, --debug                       Enable debug logging
  -f, --file=<value>...             [default: ] Compose configuration file
  -p, --project=<value>             Project name. Defaults to the Compose project name
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
  --lightsail-region=<option>  AWS region in which resources will be provisioned
                               <options: us-east-2|us-east-1|us-west-2|ap-south-1|ap-northeast-2|ap-southeast-1|ap-south
                               east-2|ap-northeast-1|ca-central-1|eu-central-1|eu-west-1|eu-west-2|eu-west-3|eu-north-1>

DESCRIPTION
  Delete preview environments
```

_See code: [dist/commands/down.ts](https://github.com/livecycle/preevy/blob/v0.0.52/dist/commands/down.ts)_

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

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v5.2.9/src/commands/help.ts)_

## `preevy init [PROFILE-ALIAS]`

Initialize or import a new profile

```
USAGE
  $ preevy init [PROFILE-ALIAS] [-D] [-f <value>] [--system-compose-file <value>] [-p <value>] [-f <value>]

ARGUMENTS
  PROFILE-ALIAS  [default: default] Alias of the profile

FLAGS
  -f, --from=<value>  Import profile from existing path

GLOBAL FLAGS
  -D, --debug                       Enable debug logging
  -f, --file=<value>...             [default: ] Compose configuration file
  -p, --project=<value>             Project name. Defaults to the Compose project name
  --system-compose-file=<value>...  [default: ] Add extra Compose configuration file without overriding the defaults

DESCRIPTION
  Initialize or import a new profile
```

_See code: [dist/commands/init.ts](https://github.com/livecycle/preevy/blob/v0.0.52/dist/commands/init.ts)_

## `preevy login`

Login to the Livecycle SaaS

```
USAGE
  $ preevy login [-D] [-f <value>] [--system-compose-file <value>] [-p <value>] [--lc-auth-url <value>]
    [--lc-api-url <value>] [--lc-client-id <value>]

FLAGS
  --lc-api-url=<value>    [default: https://app.livecycle.run] The Livecycle API URL'
  --lc-auth-url=<value>   [default: https://livecycle.us.auth0.com] The login URL
  --lc-client-id=<value>  [default: BHXcVtapfKPEpZtYO3AJ2Livmz6j7xK0] The client ID for the OAuth app

GLOBAL FLAGS
  -D, --debug                       Enable debug logging
  -f, --file=<value>...             [default: ] Compose configuration file
  -p, --project=<value>             Project name. Defaults to the Compose project name
  --system-compose-file=<value>...  [default: ] Add extra Compose configuration file without overriding the defaults

DESCRIPTION
  Login to the Livecycle SaaS
```

_See code: [dist/commands/login.ts](https://github.com/livecycle/preevy/blob/v0.0.52/dist/commands/login.ts)_

## `preevy logs [SERVICES]`

Show logs for an existing environment

```
USAGE
  $ preevy logs [SERVICES] [-D] [-f <value>] [--system-compose-file <value>] [-p <value>] [--profile
    <value>] [-d lightsail|gce|azure|kube-pod] [--lightsail-region us-east-2|us-east-1|us-west-2|ap-south-1|ap-northeast
    -2|ap-southeast-1|ap-southeast-2|ap-northeast-1|ca-central-1|eu-central-1|eu-west-1|eu-west-2|eu-west-3|eu-north-1]
    [--gce-project-id <value>] [--gce-zone <value>] [--azure-region <value>] [--azure-subscription-id <value>]
    [--kube-pod-namespace <value>] [--kube-pod-kubeconfig <value>] [--kube-pod-context <value>] [--kube-pod-template
    <value>] [--id <value>] [--follow] [--tail <value>] [--no-log-prefix] [--timestamps] [--since <value>] [--until
    <value>]

ARGUMENTS
  SERVICES  Service name(s). If not specified, will show all services

FLAGS
  -d, --driver=<option>  Machine driver to use
                         <options: lightsail|gce|azure|kube-pod>
  --follow               Follow log output
  --id=<value>           Environment id - affects created URLs. If not specified, will try to detect automatically
  --no-log-prefix        Don't print log prefix in logs
  --profile=<value>      Run in a specific profile context
  --since=<value>        Show logs since timestamp
  --tail=<value>         Number of lines to show from the end of the logs for each container (default: all)
  --timestamps           Show timestamps
  --until=<value>        Show logs before timestamp

GLOBAL FLAGS
  -D, --debug                       Enable debug logging
  -f, --file=<value>...             [default: ] Compose configuration file
  -p, --project=<value>             Project name. Defaults to the Compose project name
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
  --lightsail-region=<option>  AWS region in which resources will be provisioned
                               <options: us-east-2|us-east-1|us-west-2|ap-south-1|ap-northeast-2|ap-southeast-1|ap-south
                               east-2|ap-northeast-1|ca-central-1|eu-central-1|eu-west-1|eu-west-2|eu-west-3|eu-north-1>

DESCRIPTION
  Show logs for an existing environment
```

_See code: [dist/commands/logs.ts](https://github.com/livecycle/preevy/blob/v0.0.52/dist/commands/logs.ts)_

## `preevy ls`

List preview environments

```
USAGE
  $ preevy ls [-D] [-f <value>] [--system-compose-file <value>] [-p <value>] [--profile <value>] [-d
    lightsail|gce|azure|kube-pod] [--lightsail-region us-east-2|us-east-1|us-west-2|ap-south-1|ap-northeast-2|ap-southea
    st-1|ap-southeast-2|ap-northeast-1|ca-central-1|eu-central-1|eu-west-1|eu-west-2|eu-west-3|eu-north-1]
    [--gce-project-id <value>] [--gce-zone <value>] [--azure-region <value>] [--azure-subscription-id <value>]
    [--kube-pod-namespace <value>] [--kube-pod-kubeconfig <value>] [--kube-pod-context <value>] [--kube-pod-template
    <value>] [--columns <value> | -x] [--sort <value>] [--filter <value>] [--output csv|json|yaml |  | [--csv |
    --no-truncate]] [--no-header | ] [--json]

FLAGS
  -d, --driver=<option>  Machine driver to use
                         <options: lightsail|gce|azure|kube-pod>
  -x, --extended         show extra columns
  --columns=<value>      only show provided columns (comma-separated)
  --csv                  output is csv format [alias: --output=csv]
  --filter=<value>       filter property by partial string matching, ex: name=foo
  --no-header            hide table header from output
  --no-truncate          do not truncate output to fit screen
  --output=<option>      output in a more machine friendly format
                         <options: csv|json|yaml>
  --profile=<value>      Run in a specific profile context
  --sort=<value>         property to sort by (prepend '-' for descending)

GLOBAL FLAGS
  -D, --debug                       Enable debug logging
  -f, --file=<value>...             [default: ] Compose configuration file
  -p, --project=<value>             Project name. Defaults to the Compose project name
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
  --lightsail-region=<option>  AWS region in which resources will be provisioned
                               <options: us-east-2|us-east-1|us-west-2|ap-south-1|ap-northeast-2|ap-southeast-1|ap-south
                               east-2|ap-northeast-1|ca-central-1|eu-central-1|eu-west-1|eu-west-2|eu-west-3|eu-north-1>

DESCRIPTION
  List preview environments
```

_See code: [dist/commands/ls.ts](https://github.com/livecycle/preevy/blob/v0.0.52/dist/commands/ls.ts)_

## `preevy profile config update`

View and update profile configuration

```
USAGE
  $ preevy profile config update [-D] [-f <value>] [--system-compose-file <value>] [-p <value>] [--profile <value>]
    [--lightsail-region us-east-2|us-east-1|us-west-2|ap-south-1|ap-northeast-2|ap-southeast-1|ap-southeast-2|ap-northea
    st-1|ca-central-1|eu-central-1|eu-west-1|eu-west-2|eu-west-3|eu-north-1] [--gce-project-id <value>] [--gce-zone
    <value>] [--azure-region <value>] [--azure-subscription-id <value>] [--kube-pod-namespace <value>]
    [--kube-pod-kubeconfig <value>] [--kube-pod-context <value>] [--kube-pod-template <value>]
    [--lightsail-availability-zone <value>] [--lightsail-bundle-id
    nano_2_0|micro_2_0|small_2_0|medium_2_0|large_2_0|xlarge_2_0|2xlarge_2_0] [--gce-machine-type <value>]
    [--azure-vm-size <value>] [--azure-resource-group-name <value>] [--kube-pod-server-side-apply] [-d
    lightsail|gce|azure|kube-pod] [--unset <value>] [--json]

FLAGS
  -d, --driver=<option>  Machine driver to use
                         <options: lightsail|gce|azure|kube-pod>
  --profile=<value>      Run in a specific profile context
  --unset=<value>...     Unset a configuration option

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
  $ preevy profile config view [-D] [-f <value>] [--system-compose-file <value>] [-p <value>] [--profile <value>]
  [--json]

FLAGS
  --profile=<value>  Run in a specific profile context

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
  $ preevy profile create NAME URL [-D] [-f <value>] [--system-compose-file <value>] [-p <value>] [--profile
    <value>] [--lightsail-region us-east-2|us-east-1|us-west-2|ap-south-1|ap-northeast-2|ap-southeast-1|ap-southeast-2|a
    p-northeast-1|ca-central-1|eu-central-1|eu-west-1|eu-west-2|eu-west-3|eu-north-1] [--gce-project-id <value>]
    [--gce-zone <value>] [--azure-region <value>] [--azure-subscription-id <value>] [--kube-pod-namespace <value>]
    [--kube-pod-kubeconfig <value>] [--kube-pod-context <value>] [--kube-pod-template <value>]
    [--lightsail-availability-zone <value>] [--lightsail-bundle-id
    nano_2_0|micro_2_0|small_2_0|medium_2_0|large_2_0|xlarge_2_0|2xlarge_2_0] [--gce-machine-type <value>]
    [--azure-vm-size <value>] [--azure-resource-group-name <value>] [--kube-pod-server-side-apply] [-d
    lightsail|gce|azure|kube-pod] [--use] [--json]

ARGUMENTS
  NAME  name of the new profile
  URL   url of the new profile store

FLAGS
  -d, --driver=<option>  Machine driver to use
                         <options: lightsail|gce|azure|kube-pod>
  --profile=<value>      Run in a specific profile context
  --use                  use the new profile

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
  $ preevy profile current [-D] [-f <value>] [--system-compose-file <value>] [-p <value>] [--profile <value>] [--json]

FLAGS
  --profile=<value>  Run in a specific profile context

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
    [--use] [--json]

ARGUMENTS
  LOCATION  location of the profile

FLAGS
  --name=<value>  name of the profile
  --use           use the imported profile

GLOBAL FLAGS
  -D, --debug                       Enable debug logging
  -f, --file=<value>...             [default: ] Compose configuration file
  -p, --project=<value>             Project name. Defaults to the Compose project name
  --json                            Format output as json.
  --system-compose-file=<value>...  [default: ] Add extra Compose configuration file without overriding the defaults

DESCRIPTION
  Import an existing profile
```

## `preevy profile key [TYPE]`

Show profile key

```
USAGE
  $ preevy profile key [TYPE] [-D] [-f <value>] [--system-compose-file <value>] [-p <value>] [--profile <value>]
    [--json]

ARGUMENTS
  TYPE  (private|public-pem|public-ssh|thumbprint|thumbprint-uri) [default: thumbprint-uri] type of the key to show

FLAGS
  --profile=<value>  Run in a specific profile context

GLOBAL FLAGS
  -D, --debug                       Enable debug logging
  -f, --file=<value>...             [default: ] Compose configuration file
  -p, --project=<value>             Project name. Defaults to the Compose project name
  --json                            Format output as json.
  --system-compose-file=<value>...  [default: ] Add extra Compose configuration file without overriding the defaults

DESCRIPTION
  Show profile key
```

## `preevy profile link`

Link the profile to the logged in user's organization

```
USAGE
  $ preevy profile link [-D] [-f <value>] [--system-compose-file <value>] [-p <value>] [--profile <value>]
    [--lc-api-url <value>] [--access_token <value>] [--org <value>]

FLAGS
  --access_token=<value>  Livecycle's Access Token
  --lc-api-url=<value>    [default: https://app.livecycle.run] The Livecycle API URL'
  --org=<value>           Target organization slug for linking the profile
  --profile=<value>       Run in a specific profile context

GLOBAL FLAGS
  -D, --debug                       Enable debug logging
  -f, --file=<value>...             [default: ] Compose configuration file
  -p, --project=<value>             Project name. Defaults to the Compose project name
  --system-compose-file=<value>...  [default: ] Add extra Compose configuration file without overriding the defaults

DESCRIPTION
  Link the profile to the logged in user's organization
```

## `preevy profile ls`

Lists profiles

```
USAGE
  $ preevy profile ls [-D] [-f <value>] [--system-compose-file <value>] [-p <value>] [--profile <value>] [--json]

FLAGS
  --profile=<value>  Run in a specific profile context

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
  $ preevy profile rm NAME [-D] [-f <value>] [--system-compose-file <value>] [-p <value>] [--profile <value>]
    [--json]

ARGUMENTS
  NAME  name of the profile to remove

FLAGS
  --profile=<value>  Run in a specific profile context

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
  $ preevy profile use NAME [-D] [-f <value>] [--system-compose-file <value>] [-p <value>] [--profile <value>]
    [--json]

ARGUMENTS
  NAME  name of the profile to use

FLAGS
  --profile=<value>  Run in a specific profile context

GLOBAL FLAGS
  -D, --debug                       Enable debug logging
  -f, --file=<value>...             [default: ] Compose configuration file
  -p, --project=<value>             Project name. Defaults to the Compose project name
  --json                            Format output as json.
  --system-compose-file=<value>...  [default: ] Add extra Compose configuration file without overriding the defaults

DESCRIPTION
  Set current profile
```

## `preevy purge`

Delete all cloud provider machines, and potentially other resources

```
USAGE
  $ preevy purge [-D] [-f <value>] [--system-compose-file <value>] [-p <value>] [--profile <value>] [-d
    lightsail|gce|azure|kube-pod] [--lightsail-region us-east-2|us-east-1|us-west-2|ap-south-1|ap-northeast-2|ap-southea
    st-1|ap-southeast-2|ap-northeast-1|ca-central-1|eu-central-1|eu-west-1|eu-west-2|eu-west-3|eu-north-1]
    [--gce-project-id <value>] [--gce-zone <value>] [--azure-region <value>] [--azure-subscription-id <value>]
    [--kube-pod-namespace <value>] [--kube-pod-kubeconfig <value>] [--kube-pod-context <value>] [--kube-pod-template
    <value>] [--all] [--type <value>] [--force] [--wait] [--json]

FLAGS
  -d, --driver=<option>  Machine driver to use
                         <options: lightsail|gce|azure|kube-pod>
  --all                  Remove all resources types (snapshots, keypairs, and other resource types)
  --force                Do not ask for confirmation
  --profile=<value>      Run in a specific profile context
  --type=<value>...      [default: machine] Resource type(s) to delete
  --wait                 Wait for resource deletion to complete. If false (the default), the deletion will be started
                         but not waited for

GLOBAL FLAGS
  -D, --debug                       Enable debug logging
  -f, --file=<value>...             [default: ] Compose configuration file
  -p, --project=<value>             Project name. Defaults to the Compose project name
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
  --lightsail-region=<option>  AWS region in which resources will be provisioned
                               <options: us-east-2|us-east-1|us-west-2|ap-south-1|ap-northeast-2|ap-southeast-1|ap-south
                               east-2|ap-northeast-1|ca-central-1|eu-central-1|eu-west-1|eu-west-2|eu-west-3|eu-north-1>

DESCRIPTION
  Delete all cloud provider machines, and potentially other resources
```

_See code: [dist/commands/purge.ts](https://github.com/livecycle/preevy/blob/v0.0.52/dist/commands/purge.ts)_

## `preevy up [SERVICE]`

Bring up a preview environment

```
USAGE
  $ preevy up [SERVICE] (--access-credentials-type api|browser --include-access-credentials) [-D] [-f
    <value>] [--system-compose-file <value>] [-p <value>] [--profile <value>] [-d lightsail|gce|azure|kube-pod]
    [--lightsail-region us-east-2|us-east-1|us-west-2|ap-south-1|ap-northeast-2|ap-southeast-1|ap-southeast-2|ap-northea
    st-1|ca-central-1|eu-central-1|eu-west-1|eu-west-2|eu-west-3|eu-north-1] [--gce-project-id <value>] [--gce-zone
    <value>] [--azure-region <value>] [--azure-subscription-id <value>] [--kube-pod-namespace <value>]
    [--kube-pod-kubeconfig <value>] [--kube-pod-context <value>] [--kube-pod-template <value>]
    [--lightsail-availability-zone <value>] [--lightsail-bundle-id
    nano_2_0|micro_2_0|small_2_0|medium_2_0|large_2_0|xlarge_2_0|2xlarge_2_0] [--gce-machine-type <value>]
    [--azure-vm-size <value>] [--azure-resource-group-name <value>] [--kube-pod-server-side-apply] [--id <value>] [-t
    <value>] [--tls-hostname <value>] [--insecure-skip-verify] [--skip-unchanged-files] [--show-preevy-service-urls]
    [--columns <value> | -x] [--sort <value>] [--filter <value>] [--output csv|json|yaml |  | [--csv | --no-truncate]]
    [--no-header | ]

ARGUMENTS
  SERVICE  Service name(s). If not specified, will deploy all services

FLAGS
  -d, --driver=<option>               Machine driver to use
                                      <options: lightsail|gce|azure|kube-pod>
  -t, --tunnel-url=<value>            [default: ssh+tls://livecycle.run] Tunnel url, specify ssh://hostname[:port] or
                                      ssh+tls://hostname[:port]
  -x, --extended                      show extra columns
  --access-credentials-type=<option>  (required) [default: browser]
                                      <options: api|browser>
  --columns=<value>                   only show provided columns (comma-separated)
  --csv                               output is csv format [alias: --output=csv]
  --filter=<value>                    filter property by partial string matching, ex: name=foo
  --id=<value>                        Environment id - affects created URLs. If not specified, will try to detect
                                      automatically
  --include-access-credentials        Include access credentials for basic auth for each service URL
  --insecure-skip-verify              Skip TLS or SSH certificate verification
  --no-header                         hide table header from output
  --no-truncate                       do not truncate output to fit screen
  --output=<option>                   output in a more machine friendly format
                                      <options: csv|json|yaml>
  --profile=<value>                   Run in a specific profile context
  --show-preevy-service-urls          Show URLs for internal Preevy services
  --[no-]skip-unchanged-files         Detect and skip unchanged files when copying (default: true)
  --sort=<value>                      property to sort by (prepend '-' for descending)
  --tls-hostname=<value>              Override TLS server name when tunneling via HTTPS

GLOBAL FLAGS
  -D, --debug                       Enable debug logging
  -f, --file=<value>...             [default: ] Compose configuration file
  -p, --project=<value>             Project name. Defaults to the Compose project name
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
  --lightsail-region=<option>            AWS region in which resources will be provisioned
                                         <options: us-east-2|us-east-1|us-west-2|ap-south-1|ap-northeast-2|ap-southeast-
                                         1|ap-southeast-2|ap-northeast-1|ca-central-1|eu-central-1|eu-west-1|eu-west-2|e
                                         u-west-3|eu-north-1>

DESCRIPTION
  Bring up a preview environment
```

_See code: [dist/commands/up.ts](https://github.com/livecycle/preevy/blob/v0.0.52/dist/commands/up.ts)_

## `preevy urls [SERVICE] [PORT]`

Show urls for an existing environment

```
USAGE
  $ preevy urls [SERVICE] [PORT] (--access-credentials-type api|browser --include-access-credentials) [-D]
    [-f <value>] [--system-compose-file <value>] [-p <value>] [--profile <value>] [--id <value>] [-t <value>]
    [--tls-hostname <value>] [--insecure-skip-verify] [--columns <value> | -x] [--sort <value>] [--filter <value>]
    [--output csv|json|yaml |  | [--csv | --no-truncate]] [--no-header | ] [--show-preevy-service-urls] [--json]

ARGUMENTS
  SERVICE  Service name. If not specified, will show all services
  PORT     Service port. If not specified, will show all ports for the specified service

FLAGS
  -t, --tunnel-url=<value>            [default: ssh+tls://livecycle.run] Tunnel url, specify ssh://hostname[:port] or
                                      ssh+tls://hostname[:port]
  -x, --extended                      show extra columns
  --access-credentials-type=<option>  (required) [default: browser]
                                      <options: api|browser>
  --columns=<value>                   only show provided columns (comma-separated)
  --csv                               output is csv format [alias: --output=csv]
  --filter=<value>                    filter property by partial string matching, ex: name=foo
  --id=<value>                        Environment id - affects created URLs. If not specified, will try to detect
                                      automatically
  --include-access-credentials        Include access credentials for basic auth for each service URL
  --insecure-skip-verify              Skip TLS or SSH certificate verification
  --no-header                         hide table header from output
  --no-truncate                       do not truncate output to fit screen
  --output=<option>                   output in a more machine friendly format
                                      <options: csv|json|yaml>
  --profile=<value>                   Run in a specific profile context
  --show-preevy-service-urls          Show URLs for internal Preevy services
  --sort=<value>                      property to sort by (prepend '-' for descending)
  --tls-hostname=<value>              Override TLS server name when tunneling via HTTPS

GLOBAL FLAGS
  -D, --debug                       Enable debug logging
  -f, --file=<value>...             [default: ] Compose configuration file
  -p, --project=<value>             Project name. Defaults to the Compose project name
  --json                            Format output as json.
  --system-compose-file=<value>...  [default: ] Add extra Compose configuration file without overriding the defaults

DESCRIPTION
  Show urls for an existing environment
```

_See code: [dist/commands/urls.ts](https://github.com/livecycle/preevy/blob/v0.0.52/dist/commands/urls.ts)_

## `preevy version`

Show Preevy version

```
USAGE
  $ preevy version [-D] [-f <value>] [--system-compose-file <value>] [-p <value>] [--json]

GLOBAL FLAGS
  -D, --debug                       Enable debug logging
  -f, --file=<value>...             [default: ] Compose configuration file
  -p, --project=<value>             Project name. Defaults to the Compose project name
  --json                            Format output as json.
  --system-compose-file=<value>...  [default: ] Add extra Compose configuration file without overriding the defaults

DESCRIPTION
  Show Preevy version
```

_See code: [dist/commands/version.ts](https://github.com/livecycle/preevy/blob/v0.0.52/dist/commands/version.ts)_
<!-- commandsstop -->
