`preevy version`
================

Show Preevy version

* [`preevy version`](#preevy-version)

## `preevy version`

Show Preevy version

```
USAGE
  $ preevy version [--json] [-D] [-f <value>] [--system-compose-file <value>] [--project-directory <value>]
    [-p <value>] [--enable-plugin <value>] [--disable-plugin <value>]

FLAGS
  --project-directory=<value>  Alternate working directory (default: the path of the first specified Compose file)

GLOBAL FLAGS
  -D, --debug                           Enable debug logging
  -f, --file=<value>...                 [default: ] Compose configuration file
  -p, --project=<value>                 Project name. Defaults to the Compose project name
      --disable-plugin=<value>...       Disable plugin with specified package name
      --enable-plugin=<value>...        [default: @preevy/plugin-github] Enable plugin with specified package name
      --json                            Format output as json.
      --system-compose-file=<value>...  [default: ] Add extra Compose configuration file without overriding the defaults

DESCRIPTION
  Show Preevy version
```

_See code: [src/commands/version.ts](https://github.com/livecycle/preevy/blob/v0.0.64/src/commands/version.ts)_
