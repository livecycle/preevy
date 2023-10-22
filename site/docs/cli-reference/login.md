`preevy login`
==============

Login to the Livecycle SaaS

* [`preevy login`](#preevy-login)

## `preevy login`

Login to the Livecycle SaaS

```
USAGE
  $ preevy login [-D] [-f <value>] [--system-compose-file <value>] [-p <value>] [--lc-auth-url <value>]
    [--lc-api-url <value>] [--lc-client-id <value>]

FLAGS
  --lc-api-url=<value>    [default: https://app.livecycle.run] The Livecycle API URL'
  --lc-auth-url=<value>   [default: https://auth.livecycle.dev] The login URL
  --lc-client-id=<value>  [default: BHXcVtapfKPEpZtYO3AJ2Livmz6j7xK0] The client ID for the OAuth app

GLOBAL FLAGS
  -D, --debug                       Enable debug logging
  -f, --file=<value>...             [default: ] Compose configuration file
  -p, --project=<value>             Project name. Defaults to the Compose project name
  --system-compose-file=<value>...  [default: ] Add extra Compose configuration file without overriding the defaults

DESCRIPTION
  Login to the Livecycle SaaS
```

_See code: [dist/commands/login.ts](https://github.com/livecycle/preevy/blob/v0.0.55/packages/cli/src/commands/login.ts)_
