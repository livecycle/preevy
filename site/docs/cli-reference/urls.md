`preevy urls`
=============

Show URLs for an existing environment

* [`preevy urls [SERVICE] [PORT]`](#preevy-urls-service-port)

## `preevy urls [SERVICE] [PORT]`

Show URLs for an existing environment

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
      --profile=<value>                   Run in a specific profile context (either an alias or a URL)
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

_See code: [src/commands/urls.ts](https://github.com/livecycle/preevy/blob/v0.0.58/src/commands/urls.ts)_
