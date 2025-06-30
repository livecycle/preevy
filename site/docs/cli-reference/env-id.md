`preevy env-id`
===============

Show the Preevy environment ID for the current Compose project

* [`preevy env-id`](#preevy-env-id)

## `preevy env-id`

Show the Preevy environment ID for the current Compose project

```
USAGE
  $ preevy env-id [--json] [-D] [-f <value>...] [--system-compose-file <value>...] [--project-directory
    <value>] [-p <value>] [--enable-plugin <value>...] [--disable-plugin <value>...] [--profile <value>] [--id <value>]

FLAGS
  --id=<value>                 Environment id
  --profile=<value>            Run in a specific profile context (either an alias or a URL)
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
  Show the Preevy environment ID for the current Compose project

FLAG DESCRIPTIONS
  --id=<value>  Environment id

    Affects created URLs
    If not specified, will detect from the current Git context
```

_See code: [src/commands/env-id.ts](https://github.com/livecycle/preevy/blob/v0.0.67/src/commands/env-id.ts)_
