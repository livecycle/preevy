`preevy login`
==============

Login to the Livecycle SaaS

* [`preevy login`](#preevy-login)

## `preevy login`

Login to the Livecycle SaaS

```
USAGE
  $ preevy login [-D] [-f <value>] [--system-compose-file <value>] [--project-directory <value>] [-p
    <value>] [--enable-plugin <value>] [--disable-plugin <value>] [--lc-auth-url <value>] [--lc-api-url <value>]
    [--lc-client-id <value>]

FLAGS
  --lc-api-url=<value>         [default: https://app.livecycle.run] The Livecycle API URL'
  --lc-auth-url=<value>        [default: https://auth.livecycle.dev] The login URL
  --lc-client-id=<value>       [default: BHXcVtapfKPEpZtYO3AJ2Livmz6j7xK0] The client ID for the OAuth app
  --project-directory=<value>  Alternate working directory (default: the path of the first specified Compose file)

GLOBAL FLAGS
  -D, --debug                           Enable debug logging
  -f, --file=<value>...                 [default: ] Compose configuration file
  -p, --project=<value>                 Project name. Defaults to the Compose project name
      --disable-plugin=<value>...       Disable plugin with specified package name
      --enable-plugin=<value>...        [default: @preevy/plugin-github] Enable plugin with specified package name
      --system-compose-file=<value>...  [default: ] Add extra Compose configuration file without overriding the defaults

DESCRIPTION
  Login to the Livecycle SaaS
```

_See code: [src/commands/login.ts](https://github.com/livecycle/preevy/blob/v0.0.60/src/commands/login.ts)_
