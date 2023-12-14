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
preevy/0.0.58 darwin-arm64 node-v18.12.1
$ preevy --help [COMMAND]
USAGE
  $ preevy COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
# Command Topics

* [`preevy down`](docs/down.md) - Delete preview environments
* [`preevy help`](docs/help.md) - Display help for preevy.
* [`preevy init`](docs/init.md) - Initialize or import a new profile
* [`preevy login`](docs/login.md) - Login to the Livecycle SaaS
* [`preevy logs`](docs/logs.md) - Show logs for an existing environment
* [`preevy ls`](docs/ls.md) - List preview environments
* [`preevy profile`](docs/profile.md) - View and update profile configuration
* [`preevy purge`](docs/purge.md) - Delete all cloud provider machines, and potentially other resources
* [`preevy ssh`](docs/ssh.md) - Execute a command or start an interactive shell inside an environment
* [`preevy up`](docs/up.md) - Bring up a preview environment
* [`preevy urls`](docs/urls.md) - Show urls for an existing environment
* [`preevy version`](docs/version.md) - Show Preevy version

<!-- commandsstop -->
