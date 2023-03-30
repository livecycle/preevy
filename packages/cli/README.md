Preevy CLI
=================

[![Version](https://img.shields.io/npm/v/preevy.svg)](https://npmjs.org/package/preevy)
[![Downloads/week](https://img.shields.io/npm/dw/preevy.svg)](https://npmjs.org/package/preevy)
[![License](https://img.shields.io/npm/l/preevy.svg)](https://github.com/livecycle/preevy/blob/main/LICENSE)

Preevy is a CLI tool for provisioning preview environments.
Using preview, you can provision any docker compose app on your favorite cloud (currently AWS is only supported)


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
preevy/0.0.16 darwin-arm64 node-v18.12.1
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
* [`preevy logs [SERVICES]`](#preevy-logs-services)
* [`preevy ls`](#preevy-ls)
* [`preevy plugins`](#preevy-plugins)
* [`preevy plugins:install PLUGIN...`](#preevy-pluginsinstall-plugin)
* [`preevy plugins:inspect PLUGIN...`](#preevy-pluginsinspect-plugin)
* [`preevy plugins:install PLUGIN...`](#preevy-pluginsinstall-plugin-1)
* [`preevy plugins:link PLUGIN`](#preevy-pluginslink-plugin)
* [`preevy plugins:uninstall PLUGIN...`](#preevy-pluginsuninstall-plugin)
* [`preevy plugins:uninstall PLUGIN...`](#preevy-pluginsuninstall-plugin-1)
* [`preevy plugins:uninstall PLUGIN...`](#preevy-pluginsuninstall-plugin-2)
* [`preevy plugins update`](#preevy-plugins-update)
* [`preevy profile create NAME URL`](#preevy-profile-create-name-url)
* [`preevy profile current`](#preevy-profile-current)
* [`preevy profile import LOCATION`](#preevy-profile-import-location)
* [`preevy profile ls`](#preevy-profile-ls)
* [`preevy profile rm NAME`](#preevy-profile-rm-name)
* [`preevy profile use NAME`](#preevy-profile-use-name)
* [`preevy up [SERVICE]`](#preevy-up-service)
* [`preevy urls [SERVICE] [PORT]`](#preevy-urls-service-port)
* [`preevy version`](#preevy-version)

## `preevy down`

Delete preview environments

```
USAGE
  $ preevy down [-D] [-d lightsail|fake] [--lightsail-region
    us-east-2|us-east-1|us-west-2|ap-south-1|ap-northeast-2|ap-southeast-1|ap-southeast-2|ap-northeast-1|ca-central-1|eu
    -central-1|eu-west-1|eu-west-2|eu-west-3|eu-north-1] [--lightsail-availability-zone <value>] [--id <value>] [-f
    <value>] [-p <value>] [--force] [--json]

FLAGS
  -d, --driver=<option>                  [default: lightsail] Machine driver to use
                                         <options: lightsail|fake>
  -f, --file=<value>...                  [default: ] Compose configuration file
  -p, --project=<value>                  Project name. Defaults to the Compose project name
  --force                                Do not error if the environment is not found
  --id=<value>                           Environment id - affects created URLs. If not specified, will try to detect
                                         automatically
  --lightsail-availability-zone=<value>  AWS availability zone to provision resources in region
  --lightsail-region=<option>            Which AWS region will be used to provision resources?
                                         <options: us-east-2|us-east-1|us-west-2|ap-south-1|ap-northeast-2|ap-southeast-
                                         1|ap-southeast-2|ap-northeast-1|ca-central-1|eu-central-1|eu-west-1|eu-west-2|e
                                         u-west-3|eu-north-1>

GLOBAL FLAGS
  -D, --debug  Enable debug logging
  --json       Format output as json.

DESCRIPTION
  Delete preview environments
```

_See code: [dist/commands/down/index.ts](https://github.com/livecycle/preevy/blob/v0.0.16/dist/commands/down/index.ts)_

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

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v5.2.6/src/commands/help.ts)_

## `preevy init [PROFILE-ALIAS]`

Initialize or import a new profile

```
USAGE
  $ preevy init [PROFILE-ALIAS] [-D] [-f <value>]

ARGUMENTS
  PROFILE-ALIAS  [default: default] Alias of the profile

FLAGS
  -f, --from=<value>  Import profile from existing path

GLOBAL FLAGS
  -D, --debug  Enable debug logging

DESCRIPTION
  Initialize or import a new profile
```

_See code: [dist/commands/init/index.ts](https://github.com/livecycle/preevy/blob/v0.0.16/dist/commands/init/index.ts)_

## `preevy logs [SERVICES]`

Show logs for an existing environment

```
USAGE
  $ preevy logs [SERVICES] [-D] [-d lightsail|fake] [--lightsail-region
    us-east-2|us-east-1|us-west-2|ap-south-1|ap-northeast-2|ap-southeast-1|ap-southeast-2|ap-northeast-1|ca-central-1|eu
    -central-1|eu-west-1|eu-west-2|eu-west-3|eu-north-1] [--lightsail-availability-zone <value>] [--id <value>] [-f
    <value>] [-p <value>] [--columns <value> | -x] [--sort <value>] [--filter <value>] [--output csv|json|yaml |  |
    [--csv | --no-truncate]] [--no-header | ]

ARGUMENTS
  SERVICES  Service name(s). If not specified, will show all services

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
  --lightsail-region=<option>            Which AWS region will be used to provision resources?
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

DESCRIPTION
  Show logs for an existing environment
```

_See code: [dist/commands/logs.ts](https://github.com/livecycle/preevy/blob/v0.0.16/dist/commands/logs.ts)_

## `preevy ls`

List preview environments

```
USAGE
  $ preevy ls [-D] [-d lightsail|fake] [--lightsail-region
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
  --lightsail-region=<option>            Which AWS region will be used to provision resources?
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

_See code: [dist/commands/ls/index.ts](https://github.com/livecycle/preevy/blob/v0.0.16/dist/commands/ls/index.ts)_

## `preevy plugins`

List installed plugins.

```
USAGE
  $ preevy plugins [--core]

FLAGS
  --core  Show core plugins.

DESCRIPTION
  List installed plugins.

EXAMPLES
  $ preevy plugins
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v2.3.2/src/commands/plugins/index.ts)_

## `preevy plugins:install PLUGIN...`

Installs a plugin into the CLI.

```
USAGE
  $ preevy plugins:install PLUGIN...

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
  $ preevy plugins add

EXAMPLES
  $ preevy plugins:install myplugin 

  $ preevy plugins:install https://github.com/someuser/someplugin

  $ preevy plugins:install someuser/someplugin
```

## `preevy plugins:inspect PLUGIN...`

Displays installation properties of a plugin.

```
USAGE
  $ preevy plugins:inspect PLUGIN...

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
  $ preevy plugins:inspect myplugin
```

## `preevy plugins:install PLUGIN...`

Installs a plugin into the CLI.

```
USAGE
  $ preevy plugins:install PLUGIN...

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
  $ preevy plugins add

EXAMPLES
  $ preevy plugins:install myplugin 

  $ preevy plugins:install https://github.com/someuser/someplugin

  $ preevy plugins:install someuser/someplugin
```

## `preevy plugins:link PLUGIN`

Links a plugin into the CLI for development.

```
USAGE
  $ preevy plugins:link PLUGIN

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
  $ preevy plugins:link myplugin
```

## `preevy plugins:uninstall PLUGIN...`

Removes a plugin from the CLI.

```
USAGE
  $ preevy plugins:uninstall PLUGIN...

ARGUMENTS
  PLUGIN  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ preevy plugins unlink
  $ preevy plugins remove
```

## `preevy plugins:uninstall PLUGIN...`

Removes a plugin from the CLI.

```
USAGE
  $ preevy plugins:uninstall PLUGIN...

ARGUMENTS
  PLUGIN  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ preevy plugins unlink
  $ preevy plugins remove
```

## `preevy plugins:uninstall PLUGIN...`

Removes a plugin from the CLI.

```
USAGE
  $ preevy plugins:uninstall PLUGIN...

ARGUMENTS
  PLUGIN  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ preevy plugins unlink
  $ preevy plugins remove
```

## `preevy plugins update`

Update installed plugins.

```
USAGE
  $ preevy plugins update [-h] [-v]

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Update installed plugins.
```

## `preevy profile create NAME URL`

Create a new profile

```
USAGE
  $ preevy profile create NAME URL [-D] [-d lightsail|fake] [--lightsail-region
    us-east-2|us-east-1|us-west-2|ap-south-1|ap-northeast-2|ap-southeast-1|ap-southeast-2|ap-northeast-1|ca-central-1|eu
    -central-1|eu-west-1|eu-west-2|eu-west-3|eu-north-1] [--lightsail-availability-zone <value>] [--json]

ARGUMENTS
  NAME  name of the new profile
  URL   url of the new profile store

FLAGS
  -d, --driver=<option>                  [default: lightsail] Machine driver to use
                                         <options: lightsail|fake>
  --lightsail-availability-zone=<value>  AWS availability zone to provision resources in region
  --lightsail-region=<option>            Which AWS region will be used to provision resources?
                                         <options: us-east-2|us-east-1|us-west-2|ap-south-1|ap-northeast-2|ap-southeast-
                                         1|ap-southeast-2|ap-northeast-1|ca-central-1|eu-central-1|eu-west-1|eu-west-2|e
                                         u-west-3|eu-north-1>

GLOBAL FLAGS
  -D, --debug  Enable debug logging
  --json       Format output as json.

DESCRIPTION
  Create a new profile
```

## `preevy profile current`

Display current profile in use

```
USAGE
  $ preevy profile current [-D] [--json]

GLOBAL FLAGS
  -D, --debug  Enable debug logging
  --json       Format output as json.

DESCRIPTION
  Display current profile in use
```

## `preevy profile import LOCATION`

Import an existing profile

```
USAGE
  $ preevy profile import LOCATION [-D] [--name <value>] [--json]

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

## `preevy profile ls`

Lists profiles

```
USAGE
  $ preevy profile ls [-D] [-d lightsail|fake] [--lightsail-region
    us-east-2|us-east-1|us-west-2|ap-south-1|ap-northeast-2|ap-southeast-1|ap-southeast-2|ap-northeast-1|ca-central-1|eu
    -central-1|eu-west-1|eu-west-2|eu-west-3|eu-north-1] [--lightsail-availability-zone <value>] [--json]

FLAGS
  -d, --driver=<option>                  [default: lightsail] Machine driver to use
                                         <options: lightsail|fake>
  --lightsail-availability-zone=<value>  AWS availability zone to provision resources in region
  --lightsail-region=<option>            Which AWS region will be used to provision resources?
                                         <options: us-east-2|us-east-1|us-west-2|ap-south-1|ap-northeast-2|ap-southeast-
                                         1|ap-southeast-2|ap-northeast-1|ca-central-1|eu-central-1|eu-west-1|eu-west-2|e
                                         u-west-3|eu-north-1>

GLOBAL FLAGS
  -D, --debug  Enable debug logging
  --json       Format output as json.

DESCRIPTION
  Lists profiles
```

## `preevy profile rm NAME`

Remove a profile

```
USAGE
  $ preevy profile rm NAME [-D] [-d lightsail|fake] [--lightsail-region
    us-east-2|us-east-1|us-west-2|ap-south-1|ap-northeast-2|ap-southeast-1|ap-southeast-2|ap-northeast-1|ca-central-1|eu
    -central-1|eu-west-1|eu-west-2|eu-west-3|eu-north-1] [--lightsail-availability-zone <value>] [--json]

ARGUMENTS
  NAME  name of the profile to remove

FLAGS
  -d, --driver=<option>                  [default: lightsail] Machine driver to use
                                         <options: lightsail|fake>
  --lightsail-availability-zone=<value>  AWS availability zone to provision resources in region
  --lightsail-region=<option>            Which AWS region will be used to provision resources?
                                         <options: us-east-2|us-east-1|us-west-2|ap-south-1|ap-northeast-2|ap-southeast-
                                         1|ap-southeast-2|ap-northeast-1|ca-central-1|eu-central-1|eu-west-1|eu-west-2|e
                                         u-west-3|eu-north-1>

GLOBAL FLAGS
  -D, --debug  Enable debug logging
  --json       Format output as json.

DESCRIPTION
  Remove a profile
```

## `preevy profile use NAME`

Set current profile

```
USAGE
  $ preevy profile use NAME [-D] [-d lightsail|fake] [--lightsail-region
    us-east-2|us-east-1|us-west-2|ap-south-1|ap-northeast-2|ap-southeast-1|ap-southeast-2|ap-northeast-1|ca-central-1|eu
    -central-1|eu-west-1|eu-west-2|eu-west-3|eu-north-1] [--lightsail-availability-zone <value>] [--json]

ARGUMENTS
  NAME  name of the profile to use

FLAGS
  -d, --driver=<option>                  [default: lightsail] Machine driver to use
                                         <options: lightsail|fake>
  --lightsail-availability-zone=<value>  AWS availability zone to provision resources in region
  --lightsail-region=<option>            Which AWS region will be used to provision resources?
                                         <options: us-east-2|us-east-1|us-west-2|ap-south-1|ap-northeast-2|ap-southeast-
                                         1|ap-southeast-2|ap-northeast-1|ca-central-1|eu-central-1|eu-west-1|eu-west-2|e
                                         u-west-3|eu-north-1>

GLOBAL FLAGS
  -D, --debug  Enable debug logging
  --json       Format output as json.

DESCRIPTION
  Set current profile
```

## `preevy up [SERVICE]`

Bring up a preview environment

```
USAGE
  $ preevy up [SERVICE] [-D] [-d lightsail|fake] [--lightsail-region
    us-east-2|us-east-1|us-west-2|ap-south-1|ap-northeast-2|ap-southeast-1|ap-southeast-2|ap-northeast-1|ca-central-1|eu
    -central-1|eu-west-1|eu-west-2|eu-west-3|eu-north-1] [--lightsail-availability-zone <value>] [--id <value>] [-f
    <value>] [-p <value>] [-t <value>] [--tls-hostname <value>] [--insecure-skip-verify] [--columns <value> | -x]
    [--sort <value>] [--filter <value>] [--output csv|json|yaml |  | [--csv | --no-truncate]] [--no-header | ]

ARGUMENTS
  SERVICE  Service name(s). If not specified, will deploy all services

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
  --lightsail-region=<option>            Which AWS region will be used to provision resources?
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

_See code: [dist/commands/up/index.ts](https://github.com/livecycle/preevy/blob/v0.0.16/dist/commands/up/index.ts)_

## `preevy urls [SERVICE] [PORT]`

Show urls for an existing environment

```
USAGE
  $ preevy urls [SERVICE] [PORT] [-D] [-d lightsail|fake] [--lightsail-region
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
  --lightsail-region=<option>            Which AWS region will be used to provision resources?
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

_See code: [dist/commands/urls.ts](https://github.com/livecycle/preevy/blob/v0.0.16/dist/commands/urls.ts)_

## `preevy version`

Show Preevy version

```
USAGE
  $ preevy version [-D] [--json]

GLOBAL FLAGS
  -D, --debug  Enable debug logging
  --json       Format output as json.

DESCRIPTION
  Show Preevy version
```

_See code: [dist/commands/version.ts](https://github.com/livecycle/preevy/blob/v0.0.16/dist/commands/version.ts)_
<!-- commandsstop -->
