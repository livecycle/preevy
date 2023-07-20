`preevy init`
=============

Initialize or import a new profile

* [`preevy init [PROFILE-ALIAS]`](#preevy-init-profile-alias)

## `preevy init [PROFILE-ALIAS]`

Initialize or import a new profile

```
USAGE
  $ preevy init [PROFILE-ALIAS] [-D] [-f <value>] [--system-compose-file <value>] [-p <value>] [-f <value>]

ARGUMENTS
  PROFILE-ALIAS  [default: default] Alias of the profile

FLAGS
  -f, --from=<value>  Import profile from existing path

GLOBAL FLAGS
  -D, --debug                       Enable debug logging
  -f, --file=<value>...             [default: ] Compose configuration file
  -p, --project=<value>             Project name. Defaults to the Compose project name
  --system-compose-file=<value>...  [default: ] Add extra Compose configuration file without overriding the defaults

DESCRIPTION
  Initialize or import a new profile
```

_See code: [dist/commands/init.ts](https://github.com/livecycle/preevy/blob/v0.0.42/packages/cli/src/commands/init.ts)_
