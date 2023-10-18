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
preevy/0.0.55 darwin-arm64 node-v18.12.1
$ preevy --help [COMMAND]
USAGE
  $ preevy COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`preevy help [COMMANDS]`](#preevy-help-commands)
* [`preevy login`](#preevy-login)
* [`preevy profile config view`](#preevy-profile-config-view)
* [`preevy profile current`](#preevy-profile-current)
* [`preevy profile import LOCATION`](#preevy-profile-import-location)
* [`preevy profile key [TYPE]`](#preevy-profile-key-type)
* [`preevy profile link`](#preevy-profile-link)
* [`preevy profile ls`](#preevy-profile-ls)
* [`preevy profile rm NAME`](#preevy-profile-rm-name)
* [`preevy profile use NAME`](#preevy-profile-use-name)
* [`preevy urls [SERVICE] [PORT]`](#preevy-urls-service-port)
* [`preevy version`](#preevy-version)

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

_See code: [dist/commands/login.ts](https://github.com/livecycle/preevy/blob/v0.0.55/dist/commands/login.ts)_

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
    [--lc-api-url <value>] [--access-token <value>] [--org <value>]

FLAGS
  --access-token=<value>  Livecycle's Access Token
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

_See code: [dist/commands/urls.ts](https://github.com/livecycle/preevy/blob/v0.0.55/dist/commands/urls.ts)_

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

_See code: [dist/commands/version.ts](https://github.com/livecycle/preevy/blob/v0.0.55/dist/commands/version.ts)_
<!-- commandsstop -->
