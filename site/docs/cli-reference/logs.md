`preevy logs`
=============

Show logs for an existing environment

- [`preevy logs [SERVICES]`](#preevy-logs-services)

## `preevy logs [SERVICES]`

Show logs for an existing environment

```
USAGE
  $ preevy logs [SERVICES] [-D] [-f <value>] [--system-compose-file <value>] [-p <value>] [--enable-plugin
    <value>] [--disable-plugin <value>] [--profile <value>] [-d lightsail|gce|azure|kube-pod] [--lightsail-region
    <value>] [--gce-project-id <value>] [--gce-zone <value>] [--azure-region <value>] [--azure-subscription-id <value>]
    [--kube-pod-namespace <value>] [--kube-pod-kubeconfig <value>] [--kube-pod-context <value>] [--kube-pod-template
    <value>] [--id <value>] [--follow] [--tail <value>] [--no-log-prefix] [--timestamps] [--since <value>] [--until
    <value>]

ARGUMENTS
  SERVICES  Service name(s). If not specified, will show all services

FLAGS
  -d, --driver=<option>  Machine driver to use
                         <options: lightsail|gce|azure|kube-pod>
      --follow           Follow log output
      --id=<value>       Environment id
      --no-log-prefix    Don't print log prefix in logs
      --profile=<value>  Run in a specific profile context (either an alias or a URL)
      --since=<value>    Show logs since timestamp
      --tail=<value>     Number of lines to show from the end of the logs for each container (default: all)
      --timestamps       Show timestamps
      --until=<value>    Show logs before timestamp

GLOBAL FLAGS
  -D, --debug                           Enable debug logging
  -f, --file=<value>...                 [default: ] Compose configuration file
  -p, --project=<value>                 Project name. Defaults to the Compose project name
      --disable-plugin=<value>...       Disable plugin with specified package name
      --enable-plugin=<value>...        [default: @preevy/plugin-github] Enable plugin with specified package name
      --system-compose-file=<value>...  [default: ] Add extra Compose configuration file without overriding the defaults

AZURE DRIVER FLAGS
  --azure-region=<value>           Microsoft Azure region in which resources will be provisioned
  --azure-subscription-id=<value>  Microsoft Azure subscription id

GCE DRIVER FLAGS
  --gce-project-id=<value>  Google Cloud project ID
  --gce-zone=<value>        Google Cloud zone in which resources will be provisioned

KUBE-POD DRIVER FLAGS
  --kube-pod-context=<value>     kubeconfig context name (will load config from defaults if not specified)
  --kube-pod-kubeconfig=<value>  Path to kubeconfig file (will load config from defaults if not specified)
  --kube-pod-namespace=<value>   [default: default] Kubernetes namespace in which resources will be provisioned (needs
                                 to exist)
  --kube-pod-template=<value>    Path to custom resources template file (will use default template if not specified)

LIGHTSAIL DRIVER FLAGS
  --lightsail-region=<value>  AWS region in which resources will be provisioned

DESCRIPTION
  Show logs for an existing environment

FLAG DESCRIPTIONS
  --id=<value>  Environment id

    Affects created URLs
    If not specified, will detect from the current Git context
```

_See code: [src/commands/logs.ts](https://github.com/livecycle/preevy/blob/v0.0.58/src/commands/logs.ts)_
