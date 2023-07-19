Preevy CLI
=================

[![Version](https://img.shields.io/npm/v/preevy.svg)](https://npmjs.org/package/preevy)
[![Downloads/week](https://img.shields.io/npm/dw/preevy.svg)](https://npmjs.org/package/preevy)
[![License](https://img.shields.io/npm/l/preevy.svg)](https://github.com/livecycle/preevy/blob/main/LICENSE)

Preevy is a CLI tool for easily creating preview environments for your Docker Compose apps on your cloud provider - we currently support AWS and Google, with more on the way.


<!-- toc -->
* [Usage](#usage)
* [Commands](#commands)
* [Command Topics](#command-topics)
<!-- tocstop -->
# Usage
<!-- usage -->
```sh-session
$ npm install -g preevy
$ preevy COMMAND
running command...
$ preevy (--version)
preevy/0.0.40 darwin-arm64 node-v18.16.0
$ preevy --help [COMMAND]
USAGE
  $ preevy COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
# Command Topics

* [`preevy down`](commands/down.md) - Delete preview environments
* [`preevy help`](commands/help.md) - Display help for preevy.
* [`preevy init`](commands/init.md) - Initialize or import a new profile
* [`preevy logs`](commands/logs.md) - Show logs for an existing environment
* [`preevy ls`](commands/ls.md) - List preview environments
* [`preevy profile`](commands/profile.md) - Create a new profile
* [`preevy purge`](commands/purge.md) - Delete all cloud provider machines, and potentially other resources
* [`preevy up`](commands/up.md) - Bring up a preview environment
* [`preevy urls`](commands/urls.md) - Show urls for an existing environment
* [`preevy version`](commands/version.md) - Show Preevy version

<!-- commandsstop -->
