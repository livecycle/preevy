`preevy urls`
=============

Show urls for an existing environment

* [`preevy urls [SERVICE] [PORT]`](#preevy-urls-service-port)

## `preevy urls [SERVICE] [PORT]`

Show urls for an existing environment

```
USAGE
  $ preevy urls [SERVICE] [PORT] [-D] [-f <value>] [--system-compose-file <value>] [-p <value>] [--id
    <value>] [-t <value>] [--tls-hostname <value>] [--insecure-skip-verify] [--columns <value> | -x] [--sort <value>]
    [--filter <value>] [--output csv|json|yaml |  | [--csv | --no-truncate]] [--no-header | ]
    [--include-access-credentials] [--json]

ARGUMENTS
  SERVICE  Service name. If not specified, will show all services
  PORT     Service port. If not specified, will show all ports for the specified service

FLAGS
  -t, --tunnel-url=<value>      [default: ssh+tls://livecycle.run] Tunnel url, specify ssh://hostname[:port] or
                                ssh+tls://hostname[:port]
  -x, --extended                show extra columns
  --columns=<value>             only show provided columns (comma-separated)
  --csv                         output is csv format [alias: --output=csv]
  --filter=<value>              filter property by partial string matching, ex: name=foo
  --id=<value>                  Environment id - affects created URLs. If not specified, will try to detect
                                automatically
  --include-access-credentials  Include access credentials for basic auth for each service URL
  --insecure-skip-verify        Skip TLS or SSH certificate verification
  --no-header                   hide table header from output
  --no-truncate                 do not truncate output to fit screen
  --output=<option>             output in a more machine friendly format
                                <options: csv|json|yaml>
  --sort=<value>                property to sort by (prepend '-' for descending)
  --tls-hostname=<value>        Override TLS server name when tunneling via HTTPS

GLOBAL FLAGS
  -D, --debug                       Enable debug logging
  -f, --file=<value>...             [default: ] Compose configuration file
  -p, --project=<value>             Project name. Defaults to the Compose project name
  --json                            Format output as json.
  --system-compose-file=<value>...  [default: ] Add extra Compose configuration file without overriding the defaults

DESCRIPTION
  Show urls for an existing environment
```

_See code: [dist/commands/urls.ts](https://github.com/livecycle/preevy/blob/v0.0.40/packages/cli/src/commands/urls.ts)_
