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
@livecycle/preview/0.0.0 darwin-arm64 node-v18.12.1
$ preview --help [COMMAND]
USAGE
  $ preview COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`preview hello PERSON`](#preview-hello-person)
* [`preview hello world`](#preview-hello-world)
* [`preview help [COMMANDS]`](#preview-help-commands)
* [`preview plugins`](#preview-plugins)
* [`preview plugins:install PLUGIN...`](#preview-pluginsinstall-plugin)
* [`preview plugins:inspect PLUGIN...`](#preview-pluginsinspect-plugin)
* [`preview plugins:install PLUGIN...`](#preview-pluginsinstall-plugin-1)
* [`preview plugins:link PLUGIN`](#preview-pluginslink-plugin)
* [`preview plugins:uninstall PLUGIN...`](#preview-pluginsuninstall-plugin)
* [`preview plugins:uninstall PLUGIN...`](#preview-pluginsuninstall-plugin-1)
* [`preview plugins:uninstall PLUGIN...`](#preview-pluginsuninstall-plugin-2)
* [`preview plugins update`](#preview-plugins-update)

## `preview hello PERSON`

Say hello

```
USAGE
  $ preview hello [PERSON] -f <value>

ARGUMENTS
  PERSON  Person to say hello to

FLAGS
  -f, --from=<value>  (required) Who is saying hello

DESCRIPTION
  Say hello

EXAMPLES
  $ oex hello friend --from oclif
  hello friend from oclif! (./src/commands/hello/index.ts)
```

_See code: [dist/commands/hello/index.ts](https://github.com/livecycle/livecycle/blob/v0.0.0/dist/commands/hello/index.ts)_

## `preview hello world`

Say hello world

```
USAGE
  $ preview hello world

DESCRIPTION
  Say hello world

EXAMPLES
  $ preview hello world
  hello world! (./src/commands/hello/world.ts)
```

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

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v5.2.2/src/commands/help.ts)_

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

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v2.3.0/src/commands/plugins/index.ts)_

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
<!-- commandsstop -->
