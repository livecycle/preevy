oclif-hello-world
=================

oclif example Hello World CLI

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/oclif-hello-world.svg)](https://npmjs.org/package/oclif-hello-world)
[![CircleCI](https://circleci.com/gh/oclif/hello-world/tree/main.svg?style=shield)](https://circleci.com/gh/oclif/hello-world/tree/main)
[![Downloads/week](https://img.shields.io/npm/dw/oclif-hello-world.svg)](https://npmjs.org/package/oclif-hello-world)
[![License](https://img.shields.io/npm/l/oclif-hello-world.svg)](https://github.com/oclif/hello-world/blob/main/package.json)

<!-- toc -->
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->
# Usage
<!-- usage -->
```sh-session
$ npm install -g @livecycle/preview
$ preview COMMAND
running command...
$ preview (--version)
@livecycle/preview/0.0.2 darwin-arm64 node-v18.12.1
$ preview --help [COMMAND]
USAGE
  $ preview COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`preview down`](#preview-down)
* [`preview help [COMMANDS]`](#preview-help-commands)
* [`preview init [PROFILE-ALIAS]`](#preview-init-profile-alias)
* [`preview ls`](#preview-ls)
* [`preview plugins`](#preview-plugins)
* [`preview plugins:install PLUGIN...`](#preview-pluginsinstall-plugin)
* [`preview plugins:inspect PLUGIN...`](#preview-pluginsinspect-plugin)
* [`preview plugins:install PLUGIN...`](#preview-pluginsinstall-plugin-1)
* [`preview plugins:link PLUGIN`](#preview-pluginslink-plugin)
* [`preview plugins:uninstall PLUGIN...`](#preview-pluginsuninstall-plugin)
* [`preview plugins:uninstall PLUGIN...`](#preview-pluginsuninstall-plugin-1)
* [`preview plugins:uninstall PLUGIN...`](#preview-pluginsuninstall-plugin-2)
* [`preview plugins update`](#preview-plugins-update)
* [`preview profile create NAME URL`](#preview-profile-create-name-url)
* [`preview profile current`](#preview-profile-current)
* [`preview profile import LOCATION`](#preview-profile-import-location)
* [`preview profile ls`](#preview-profile-ls)
* [`preview profile rm NAME`](#preview-profile-rm-name)
* [`preview profile use NAME`](#preview-profile-use-name)
* [`preview up`](#preview-up)
* [`preview urls [SERVICE] [PORT]`](#preview-urls-service-port)

## `preview down`

Delete preview environments

```
USAGE
  $ preview down [-D] [-d lightsail|fake] [--lightsail-region
    us-east-2|us-east-1|us-west-2|ap-south-1|ap-northeast-2|ap-southeast-1|ap-southeast-2|ap-northeast-1|ca-central-1|eu
    -central-1|eu-west-1|eu-west-2|eu-west-3|eu-north-1] [--lightsail-availability-zone <value>] [--id <value>] [-f
    <value>] [-p <value>] [-f] [--json]

FLAGS
  -d, --driver=<option>                  [default: lightsail] Machine driver to use
                                         <options: lightsail|fake>
  -f, --file=<value>...                  [default: ] Compose configuration file
  -f, --force                            Do not error if the environment is not found
  -p, --project=<value>                  Project name. Defaults to the Compose project name
  --id=<value>                           Environment id - affects created URLs. If not specified, will try to detect
                                         automatically
  --lightsail-availability-zone=<value>  AWS availability zone to provision resources in region
  --lightsail-region=<option>            AWS region to provision resources in
                                         <options: us-east-2|us-east-1|us-west-2|ap-south-1|ap-northeast-2|ap-southeast-
                                         1|ap-southeast-2|ap-northeast-1|ca-central-1|eu-central-1|eu-west-1|eu-west-2|e
                                         u-west-3|eu-north-1>

GLOBAL FLAGS
  -D, --debug  Enable debug logging
  --json       Format output as json.

DESCRIPTION
  Delete preview environments
```

_See code: [dist/commands/down/index.ts](https://github.com/livecycle/preview/blob/v0.0.2/dist/commands/down/index.ts)_

## `preview help [COMMANDS]`

Display help for preview.

```
USAGE
  $ preview help [COMMANDS] [-n]

ARGUMENTS
  COMMANDS  Command to show help for.

FLAGS
  -n, --nested-commands  Include all nested commands in the output.

DESCRIPTION
  Display help for preview.
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v5.2.6/src/commands/help.ts)_

## `preview init [PROFILE-ALIAS]`

Initialize or import a new profile

```
USAGE
  $ preview init [PROFILE-ALIAS] [-D] [-f <value>]

ARGUMENTS
  PROFILE-ALIAS  [default: default] Alias of the profile

FLAGS
  -f, --from=<value>  Import profile from existing path

GLOBAL FLAGS
  -D, --debug  Enable debug logging

DESCRIPTION
  Initialize or import a new profile
```

_See code: [dist/commands/init/index.ts](https://github.com/livecycle/preview/blob/v0.0.2/dist/commands/init/index.ts)_

## `preview ls`

List preview environments

```
USAGE
  $ preview ls [-D] [-d lightsail|fake] [--lightsail-region
    us-east-2|us-east-1|us-west-2|ap-south-1|ap-northeast-2|ap-southeast-1|ap-southeast-2|ap-northeast-1|ca-central-1|eu
    -central-1|eu-west-1|eu-west-2|eu-west-3|eu-north-1] [--lightsail-availability-zone <value>] [--columns <value> |
    -x] [--sort <value>] [--filter <value>] [--output csv|json|yaml |  | [--csv | --no-truncate]] [--no-header | ]
    [--json]

FLAGS
  -d, --driver=<option>                  [default: lightsail] Machine driver to use
                                         <options: lightsail|fake>
  -x, --extended                         show extra columns
  --columns=<value>                      only show provided columns (comma-separated)
  --csv                                  output is csv format [alias: --output=csv]
  --filter=<value>                       filter property by partial string matching, ex: name=foo
  --lightsail-availability-zone=<value>  AWS availability zone to provision resources in region
  --lightsail-region=<option>            AWS region to provision resources in
                                         <options: us-east-2|us-east-1|us-west-2|ap-south-1|ap-northeast-2|ap-southeast-
                                         1|ap-southeast-2|ap-northeast-1|ca-central-1|eu-central-1|eu-west-1|eu-west-2|e
                                         u-west-3|eu-north-1>
  --no-header                            hide table header from output
  --no-truncate                          do not truncate output to fit screen
  --output=<option>                      output in a more machine friendly format
                                         <options: csv|json|yaml>
  --sort=<value>                         property to sort by (prepend '-' for descending)

GLOBAL FLAGS
  -D, --debug  Enable debug logging
  --json       Format output as json.

DESCRIPTION
  List preview environments
```

_See code: [dist/commands/ls/index.ts](https://github.com/livecycle/preview/blob/v0.0.2/dist/commands/ls/index.ts)_

## `preview plugins`

List installed plugins.

```
USAGE
  $ preview plugins [--core]

FLAGS
  --core  Show core plugins.

DESCRIPTION
  List installed plugins.

EXAMPLES
  $ preview plugins
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v2.3.2/src/commands/plugins/index.ts)_

## `preview plugins:install PLUGIN...`

Installs a plugin into the CLI.

```
USAGE
  $ preview plugins:install PLUGIN...

ARGUMENTS
  PLUGIN  Plugin to install.

FLAGS
  -f, --force    Run yarn install with force flag.
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Installs a plugin into the CLI.
  Can be installed from npm or a git url.

  Installation of a user-installed plugin will override a core plugin.

  e.g. If you have a core plugin that has a 'hello' command, installing a user-installed plugin with a 'hello' command
  will override the core plugin implementation. This is useful if a user needs to update core plugin functionality in
  the CLI without the need to patch and update the whole CLI.


ALIASES
  $ preview plugins add

EXAMPLES
  $ preview plugins:install myplugin 

  $ preview plugins:install https://github.com/someuser/someplugin

  $ preview plugins:install someuser/someplugin
```

## `preview plugins:inspect PLUGIN...`

Displays installation properties of a plugin.

```
USAGE
  $ preview plugins:inspect PLUGIN...

ARGUMENTS
  PLUGIN  [default: .] Plugin to inspect.

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Displays installation properties of a plugin.

EXAMPLES
  $ preview plugins:inspect myplugin
```

## `preview plugins:install PLUGIN...`

Installs a plugin into the CLI.

```
USAGE
  $ preview plugins:install PLUGIN...

ARGUMENTS
  PLUGIN  Plugin to install.

FLAGS
  -f, --force    Run yarn install with force flag.
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Installs a plugin into the CLI.
  Can be installed from npm or a git url.

  Installation of a user-installed plugin will override a core plugin.

  e.g. If you have a core plugin that has a 'hello' command, installing a user-installed plugin with a 'hello' command
  will override the core plugin implementation. This is useful if a user needs to update core plugin functionality in
  the CLI without the need to patch and update the whole CLI.


ALIASES
  $ preview plugins add

EXAMPLES
  $ preview plugins:install myplugin 

  $ preview plugins:install https://github.com/someuser/someplugin

  $ preview plugins:install someuser/someplugin
```

## `preview plugins:link PLUGIN`

Links a plugin into the CLI for development.

```
USAGE
  $ preview plugins:link PLUGIN

ARGUMENTS
  PATH  [default: .] path to plugin

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Links a plugin into the CLI for development.
  Installation of a linked plugin will override a user-installed or core plugin.

  e.g. If you have a user-installed or core plugin that has a 'hello' command, installing a linked plugin with a 'hello'
  command will override the user-installed or core plugin implementation. This is useful for development work.


EXAMPLES
  $ preview plugins:link myplugin
```

## `preview plugins:uninstall PLUGIN...`

Removes a plugin from the CLI.

```
USAGE
  $ preview plugins:uninstall PLUGIN...

ARGUMENTS
  PLUGIN  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ preview plugins unlink
  $ preview plugins remove
```

## `preview plugins:uninstall PLUGIN...`

Removes a plugin from the CLI.

```
USAGE
  $ preview plugins:uninstall PLUGIN...

ARGUMENTS
  PLUGIN  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ preview plugins unlink
  $ preview plugins remove
```

## `preview plugins:uninstall PLUGIN...`

Removes a plugin from the CLI.

```
USAGE
  $ preview plugins:uninstall PLUGIN...

ARGUMENTS
  PLUGIN  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ preview plugins unlink
  $ preview plugins remove
```

## `preview plugins update`

Update installed plugins.

```
USAGE
  $ preview plugins update [-h] [-v]

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Update installed plugins.
```

## `preview profile create NAME URL`

Create a new profile

```
USAGE
  $ preview profile create NAME URL [-D] [-d lightsail|fake] [--lightsail-region
    us-east-2|us-east-1|us-west-2|ap-south-1|ap-northeast-2|ap-southeast-1|ap-southeast-2|ap-northeast-1|ca-central-1|eu
    -central-1|eu-west-1|eu-west-2|eu-west-3|eu-north-1] [--lightsail-availability-zone <value>] [--json]

ARGUMENTS
  NAME  name of the new profile
  URL   url of the new profile store

FLAGS
  -d, --driver=<option>                  [default: lightsail] Machine driver to use
                                         <options: lightsail|fake>
  --lightsail-availability-zone=<value>  AWS availability zone to provision resources in region
  --lightsail-region=<option>            AWS region to provision resources in
                                         <options: us-east-2|us-east-1|us-west-2|ap-south-1|ap-northeast-2|ap-southeast-
                                         1|ap-southeast-2|ap-northeast-1|ca-central-1|eu-central-1|eu-west-1|eu-west-2|e
                                         u-west-3|eu-north-1>

GLOBAL FLAGS
  -D, --debug  Enable debug logging
  --json       Format output as json.

DESCRIPTION
  Create a new profile
```

## `preview profile current`

Display current profile in use

```
USAGE
  $ preview profile current [-D] [--json]

GLOBAL FLAGS
  -D, --debug  Enable debug logging
  --json       Format output as json.

DESCRIPTION
  Display current profile in use
```

## `preview profile import LOCATION`

Import an existing profile

```
USAGE
  $ preview profile import LOCATION [-D] [--name <value>] [--json]

ARGUMENTS
  LOCATION  location of the profile

FLAGS
  --name=<value>  [default: default] name of the profile

GLOBAL FLAGS
  -D, --debug  Enable debug logging
  --json       Format output as json.

DESCRIPTION
  Import an existing profile
```

## `preview profile ls`

Lists profiles

```
USAGE
  $ preview profile ls [-D] [-d lightsail|fake] [--lightsail-region
    us-east-2|us-east-1|us-west-2|ap-south-1|ap-northeast-2|ap-southeast-1|ap-southeast-2|ap-northeast-1|ca-central-1|eu
    -central-1|eu-west-1|eu-west-2|eu-west-3|eu-north-1] [--lightsail-availability-zone <value>] [--json]

FLAGS
  -d, --driver=<option>                  [default: lightsail] Machine driver to use
                                         <options: lightsail|fake>
  --lightsail-availability-zone=<value>  AWS availability zone to provision resources in region
  --lightsail-region=<option>            AWS region to provision resources in
                                         <options: us-east-2|us-east-1|us-west-2|ap-south-1|ap-northeast-2|ap-southeast-
                                         1|ap-southeast-2|ap-northeast-1|ca-central-1|eu-central-1|eu-west-1|eu-west-2|e
                                         u-west-3|eu-north-1>

GLOBAL FLAGS
  -D, --debug  Enable debug logging
  --json       Format output as json.

DESCRIPTION
  Lists profiles
```

## `preview profile rm NAME`

Remove a profile

```
USAGE
  $ preview profile rm NAME [-D] [-d lightsail|fake] [--lightsail-region
    us-east-2|us-east-1|us-west-2|ap-south-1|ap-northeast-2|ap-southeast-1|ap-southeast-2|ap-northeast-1|ca-central-1|eu
    -central-1|eu-west-1|eu-west-2|eu-west-3|eu-north-1] [--lightsail-availability-zone <value>] [--json]

ARGUMENTS
  NAME  name of the profile to remove

FLAGS
  -d, --driver=<option>                  [default: lightsail] Machine driver to use
                                         <options: lightsail|fake>
  --lightsail-availability-zone=<value>  AWS availability zone to provision resources in region
  --lightsail-region=<option>            AWS region to provision resources in
                                         <options: us-east-2|us-east-1|us-west-2|ap-south-1|ap-northeast-2|ap-southeast-
                                         1|ap-southeast-2|ap-northeast-1|ca-central-1|eu-central-1|eu-west-1|eu-west-2|e
                                         u-west-3|eu-north-1>

GLOBAL FLAGS
  -D, --debug  Enable debug logging
  --json       Format output as json.

DESCRIPTION
  Remove a profile
```

## `preview profile use NAME`

Set current profile

```
USAGE
  $ preview profile use NAME [-D] [-d lightsail|fake] [--lightsail-region
    us-east-2|us-east-1|us-west-2|ap-south-1|ap-northeast-2|ap-southeast-1|ap-southeast-2|ap-northeast-1|ca-central-1|eu
    -central-1|eu-west-1|eu-west-2|eu-west-3|eu-north-1] [--lightsail-availability-zone <value>] [--json]

ARGUMENTS
  NAME  name of the profile to use

FLAGS
  -d, --driver=<option>                  [default: lightsail] Machine driver to use
                                         <options: lightsail|fake>
  --lightsail-availability-zone=<value>  AWS availability zone to provision resources in region
  --lightsail-region=<option>            AWS region to provision resources in
                                         <options: us-east-2|us-east-1|us-west-2|ap-south-1|ap-northeast-2|ap-southeast-
                                         1|ap-southeast-2|ap-northeast-1|ca-central-1|eu-central-1|eu-west-1|eu-west-2|e
                                         u-west-3|eu-north-1>

GLOBAL FLAGS
  -D, --debug  Enable debug logging
  --json       Format output as json.

DESCRIPTION
  Set current profile
```

## `preview up`

Bring up a preview environment

```
USAGE
  $ preview up [-D] [-d lightsail|fake] [--lightsail-region
    us-east-2|us-east-1|us-west-2|ap-south-1|ap-northeast-2|ap-southeast-1|ap-southeast-2|ap-northeast-1|ca-central-1|eu
    -central-1|eu-west-1|eu-west-2|eu-west-3|eu-north-1] [--lightsail-availability-zone <value>] [--id <value>] [-f
    <value>] [-p <value>] [-t <value>] [--tls-hostname <value>] [--insecure-skip-verify] [--columns <value> | -x]
    [--sort <value>] [--filter <value>] [--output csv|json|yaml |  | [--csv | --no-truncate]] [--no-header | ]

FLAGS
  -d, --driver=<option>                  [default: lightsail] Machine driver to use
                                         <options: lightsail|fake>
  -f, --file=<value>...                  [default: ] Compose configuration file
  -p, --project=<value>                  Project name. Defaults to the Compose project name
  -t, --tunnel-url=<value>               [default: ssh+tls://livecycle.run] Tunnel url, specify ssh://hostname[:port] or
                                         ssh+tls://hostname[:port]
  -x, --extended                         show extra columns
  --columns=<value>                      only show provided columns (comma-separated)
  --csv                                  output is csv format [alias: --output=csv]
  --filter=<value>                       filter property by partial string matching, ex: name=foo
  --id=<value>                           Environment id - affects created URLs. If not specified, will try to detect
                                         automatically
  --insecure-skip-verify                 Skip TLS or SSH certificate verification
  --lightsail-availability-zone=<value>  AWS availability zone to provision resources in region
  --lightsail-region=<option>            AWS region to provision resources in
                                         <options: us-east-2|us-east-1|us-west-2|ap-south-1|ap-northeast-2|ap-southeast-
                                         1|ap-southeast-2|ap-northeast-1|ca-central-1|eu-central-1|eu-west-1|eu-west-2|e
                                         u-west-3|eu-north-1>
  --no-header                            hide table header from output
  --no-truncate                          do not truncate output to fit screen
  --output=<option>                      output in a more machine friendly format
                                         <options: csv|json|yaml>
  --sort=<value>                         property to sort by (prepend '-' for descending)
  --tls-hostname=<value>                 Override TLS server name when tunneling via HTTPS

GLOBAL FLAGS
  -D, --debug  Enable debug logging

DESCRIPTION
  Bring up a preview environment
```

_See code: [dist/commands/up/index.ts](https://github.com/livecycle/preview/blob/v0.0.2/dist/commands/up/index.ts)_

## `preview urls [SERVICE] [PORT]`

Show urls for an existing environment

```
USAGE
  $ preview urls [SERVICE] [PORT] [-D] [-d lightsail|fake] [--lightsail-region
    us-east-2|us-east-1|us-west-2|ap-south-1|ap-northeast-2|ap-southeast-1|ap-southeast-2|ap-northeast-1|ca-central-1|eu
    -central-1|eu-west-1|eu-west-2|eu-west-3|eu-north-1] [--lightsail-availability-zone <value>] [--id <value>] [-f
    <value>] [-p <value>] [--columns <value> | -x] [--sort <value>] [--filter <value>] [--output csv|json|yaml |  |
    [--csv | --no-truncate]] [--no-header | ] [--json]

ARGUMENTS
  SERVICE  Service name. If not specified, will show all services
  PORT     Service port. If not specified, will show all ports for the specified service

FLAGS
  -d, --driver=<option>                  [default: lightsail] Machine driver to use
                                         <options: lightsail|fake>
  -f, --file=<value>...                  [default: ] Compose configuration file
  -p, --project=<value>                  Project name. Defaults to the Compose project name
  -x, --extended                         show extra columns
  --columns=<value>                      only show provided columns (comma-separated)
  --csv                                  output is csv format [alias: --output=csv]
  --filter=<value>                       filter property by partial string matching, ex: name=foo
  --id=<value>                           Environment id - affects created URLs. If not specified, will try to detect
                                         automatically
  --lightsail-availability-zone=<value>  AWS availability zone to provision resources in region
  --lightsail-region=<option>            AWS region to provision resources in
                                         <options: us-east-2|us-east-1|us-west-2|ap-south-1|ap-northeast-2|ap-southeast-
                                         1|ap-southeast-2|ap-northeast-1|ca-central-1|eu-central-1|eu-west-1|eu-west-2|e
                                         u-west-3|eu-north-1>
  --no-header                            hide table header from output
  --no-truncate                          do not truncate output to fit screen
  --output=<option>                      output in a more machine friendly format
                                         <options: csv|json|yaml>
  --sort=<value>                         property to sort by (prepend '-' for descending)

GLOBAL FLAGS
  -D, --debug  Enable debug logging
  --json       Format output as json.

DESCRIPTION
  Show urls for an existing environment
```

_See code: [dist/commands/urls.ts](https://github.com/livecycle/preview/blob/v0.0.2/dist/commands/urls.ts)_
<!-- commandsstop -->
