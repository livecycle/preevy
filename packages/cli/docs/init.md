`preevy init`
=============

Initialize or import a new profile

* [`preevy init [PROFILE-ALIAS]`](#preevy-init-profile-alias)

## `preevy init [PROFILE-ALIAS]`

Initialize or import a new profile

```
USAGE
  $ preevy init [PROFILE-ALIAS] [-D] [-f <value>] [--system-compose-file <value>] [--project-directory
    <value>] [-p <value>] [--enable-plugin <value>] [--disable-plugin <value>] [--from <value>]

ARGUMENTS
  PROFILE-ALIAS  Name of the profile

FLAGS
  --from=<value>               Import profile from existing path
  --project-directory=<value>  Alternate working directory (default: the path of the first specified Compose file)

GLOBAL FLAGS
  -D, --debug                           Enable debug logging
  -f, --file=<value>...                 [default: ] Compose configuration file
  -p, --project=<value>                 Project name. Defaults to the Compose project name
      --disable-plugin=<value>...       Disable plugin with specified package name
      --enable-plugin=<value>...        [default: @preevy/plugin-github] Enable plugin with specified package name
      --system-compose-file=<value>...  [default: ] Add extra Compose configuration file without overriding the defaults

DESCRIPTION
  Initialize or import a new profile
```

_See code: [src/commands/init.ts](https://github.com/livecycle/preevy/blob/v0.0.60/src/commands/init.ts)_
