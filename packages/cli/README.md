Livecycle CLI
=================

[![Version](https://img.shields.io/npm/v/oclif-hello-world.svg)](https://npmjs.org/package/oclif-hello-world)
[![CircleCI](https://circleci.com/gh/oclif/hello-world/tree/main.svg?style=shield)](https://circleci.com/gh/oclif/hello-world/tree/main)
[![Downloads/week](https://img.shields.io/npm/dw/oclif-hello-world.svg)](https://npmjs.org/package/oclif-hello-world)
[![License](https://img.shields.io/npm/l/oclif-hello-world.svg)](https://github.com/oclif/hello-world/blob/main/package.json)

Preview is a CLI tool for provisioning preview environments.
Using preview, you can provision any docker compose app on your favorite cloud (currently AWS is only supported)


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
@livecycle/preview/0.0.0 darwin-arm64 node-v18.12.1
$ preview --help [COMMAND]
USAGE
  $ preview COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`preview down ID`](#preview-down-id)
* [`preview help [COMMANDS]`](#preview-help-commands)
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
* [`preview up`](#preview-up)

## `preview down ID`

Delete preview environments

```
USAGE
  $ preview down ID [--log-level debug|info|warn|error] [-d lightsail|fake] [--lightsail-region <value>]
    [--lightsail-availability-zone <value>] [-f] [--json]

ARGUMENTS
  ID  Environment IDs to delete

FLAGS
  -d, --driver=<option>                  [default: lightsail] Machine driver to use
                                         <options: lightsail|fake>
  -f, --force                            Do not error if the environment is not found
  --lightsail-availability-zone=<value>  AWS availability zone to provision resources in region
  --lightsail-region=<value>             AWS region to provision resources in

GLOBAL FLAGS
  --json                Format output as json.
  --log-level=<option>  [default: info] Specify level for logging.
                        <options: debug|info|warn|error>

DESCRIPTION
  Delete preview environments
```

_See code: [dist/commands/down/index.ts](https://github.com/livecycle/preview/blob/v0.0.0/dist/commands/down/index.ts)_

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

## `preview ls`

List preview environments

```
USAGE
  $ preview ls [--log-level debug|info|warn|error] [-d lightsail|fake] [--lightsail-region <value>]
    [--lightsail-availability-zone <value>] [--columns <value> | -x] [--sort <value>] [--filter <value>] [--output
    csv|json|yaml |  | [--csv | --no-truncate]] [--no-header | ] [--json]

FLAGS
  -d, --driver=<option>                  [default: lightsail] Machine driver to use
                                         <options: lightsail|fake>
  -x, --extended                         show extra columns
  --columns=<value>                      only show provided columns (comma-separated)
  --csv                                  output is csv format [alias: --output=csv]
  --filter=<value>                       filter property by partial string matching, ex: name=foo
  --lightsail-availability-zone=<value>  AWS availability zone to provision resources in region
  --lightsail-region=<value>             AWS region to provision resources in
  --no-header                            hide table header from output
  --no-truncate                          do not truncate output to fit screen
  --output=<option>                      output in a more machine friendly format
                                         <options: csv|json|yaml>
  --sort=<value>                         property to sort by (prepend '-' for descending)

GLOBAL FLAGS
  --json                Format output as json.
  --log-level=<option>  [default: info] Specify level for logging.
                        <options: debug|info|warn|error>

DESCRIPTION
  List preview environments
```

_See code: [dist/commands/ls/index.ts](https://github.com/livecycle/preview/blob/v0.0.0/dist/commands/ls/index.ts)_

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

## `preview up`

Bring up a preview environment

```
USAGE
  $ preview up --id <value> [--log-level debug|info|warn|error] [-d lightsail|fake] [--lightsail-region
    <value>] [--lightsail-availability-zone <value>] [-f <value>] [-t <value>] [--tls-hostname <value>]
    [--insecure-skip-verify] [--columns <value> | -x] [--sort <value>] [--filter <value>] [--output csv|json|yaml |  |
    [--csv | --no-truncate]] [--no-header | ]

FLAGS
  -d, --driver=<option>                  [default: lightsail] Machine driver to use
                                         <options: lightsail|fake>
  -f, --file=<value>...                  Compose configuration file
  -t, --tunnel-url=<value>               [default: livecycle.run] Tunnel url, specify ssh://hostname[:port] or
                                         ssh+tls://hostname[:port]
  -x, --extended                         show extra columns
  --columns=<value>                      only show provided columns (comma-separated)
  --csv                                  output is csv format [alias: --output=csv]
  --filter=<value>                       filter property by partial string matching, ex: name=foo
  --id=<value>                           (required) Environment id
  --insecure-skip-verify                 Skip TLS or SSH certificate verification
  --lightsail-availability-zone=<value>  AWS availability zone to provision resources in region
  --lightsail-region=<value>             AWS region to provision resources in
  --no-header                            hide table header from output
  --no-truncate                          do not truncate output to fit screen
  --output=<option>                      output in a more machine friendly format
                                         <options: csv|json|yaml>
  --sort=<value>                         property to sort by (prepend '-' for descending)
  --tls-hostname=<value>                 Override TLS servername when tunneling via HTTPS

GLOBAL FLAGS
  --log-level=<option>  [default: info] Specify level for logging.
                        <options: debug|info|warn|error>

DESCRIPTION
  Bring up a preview environment
```

_See code: [dist/commands/up/index.ts](https://github.com/livecycle/preview/blob/v0.0.0/dist/commands/up/index.ts)_
<!-- commandsstop -->
