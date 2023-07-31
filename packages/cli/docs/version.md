`preevy version`
================

Show Preevy version

* [`preevy version`](#preevy-version)

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

_See code: [dist/commands/version.ts](https://github.com/livecycle/preevy/blob/v0.0.42/packages/cli/src/commands/version.ts)_
