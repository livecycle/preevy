`preevy env`
============

Show metadata for a preview environment

* [`preevy env metadata`](#preevy-env-metadata)

## `preevy env metadata`

Show metadata for a preview environment

```
USAGE
  $ preevy env metadata [--json] [-D] [-f <value>...] [--system-compose-file <value>...] [--project-directory
    <value>] [-p <value>] [--enable-plugin <value>...] [--disable-plugin <value>...] [--profile <value>] [-d
    lightsail|gce|azure|kube-pod] [--lightsail-region <value>] [--gce-project-id <value>] [--gce-zone <value>]
    [--azure-region <value>] [--azure-subscription-id <value>] [--kube-pod-namespace <value>] [--kube-pod-kubeconfig
    <value>] [--kube-pod-context <value>] [--id <value>] [-t <value>] [--tls-hostname <value>] [--insecure-skip-verify]
    [--source <value>...] [--fetch-timeout <value>]

FLAGS
  -d, --driver=<option>            Machine driver to use
                                   <options: lightsail|gce|azure|kube-pod>
  -t, --tunnel-url=<value>         [default: ssh+tls://livecycle.run] Tunnel url, specify ssh://hostname[:port] or
                                   ssh+tls://hostname[:port]
      --fetch-timeout=<value>      [default: 2500] Timeout for fetching metadata from the agent in milliseconds
      --id=<value>                 Environment id
      --insecure-skip-verify       Skip TLS or SSH certificate verification
      --profile=<value>            Run in a specific profile context (either an alias or a URL)
      --project-directory=<value>  Alternate working directory (default: the path of the first specified Compose file)
      --source=<value>...          [default: agent,driver] Show metadata from the driver, the agent, or the driver if
                                   the agent is not available
      --tls-hostname=<value>       Override TLS server name when tunneling via HTTPS

GLOBAL FLAGS
  -D, --debug                           Enable debug logging
  -f, --file=<value>...                 [default: ] Compose configuration file
  -p, --project=<value>                 Project name. Defaults to the Compose project name
      --disable-plugin=<value>...       Disable plugin with specified package name
      --enable-plugin=<value>...        [default: @preevy/plugin-github] Enable plugin with specified package name
      --json                            Format output as json.
      --system-compose-file=<value>...  [default: ] Add extra Compose configuration file without overriding the defaults

AZURE DRIVER FLAGS
  --azure-region=<value>           Microsoft Azure region in which resources will be provisioned
  --azure-subscription-id=<value>  Microsoft Azure Subscription ID

GCE DRIVER FLAGS
  --gce-project-id=<value>  Google Cloud project ID
  --gce-zone=<value>        Google Cloud zone in which resources will be provisioned

KUBE-POD DRIVER FLAGS
  --kube-pod-context=<value>     kubeconfig context name (will load config from defaults if not specified)
  --kube-pod-kubeconfig=<value>  Path to kubeconfig file (will load config from defaults if not specified)
  --kube-pod-namespace=<value>   [default: default] Kubernetes namespace in which resources will be provisioned (needs
                                 to exist)

LIGHTSAIL DRIVER FLAGS
  --lightsail-region=<value>  AWS region in which resources will be provisioned

DESCRIPTION
  Show metadata for a preview environment

FLAG DESCRIPTIONS
  --id=<value>  Environment id

    Affects created URLs
    If not specified, will detect from the current Git context
```

_See code: [src/commands/env/metadata.ts](https://github.com/livecycle/preevy/blob/v0.0.67/src/commands/env/metadata.ts)_
