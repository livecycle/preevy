`preevy ssh`
============

Execute a command or start an interactive shell inside an environment

* [`preevy ssh ENVID`](#preevy-ssh-envid)

## `preevy ssh ENVID`

Execute a command or start an interactive shell inside an environment

```
USAGE
  $ preevy ssh ENVID... [-D] [-f <value>] [--system-compose-file <value>] [--project-directory <value>]
    [-p <value>] [--enable-plugin <value>] [--disable-plugin <value>] [--profile <value>] [-d
    lightsail|gce|azure|kube-pod] [--lightsail-region <value>] [--gce-project-id <value>] [--gce-zone <value>]
    [--azure-region <value>] [--azure-subscription-id <value>] [--kube-pod-namespace <value>] [--kube-pod-kubeconfig
    <value>] [--kube-pod-context <value>]

ARGUMENTS
  ENVID...  Environment id

FLAGS
  -d, --driver=<option>            Machine driver to use
                                   <options: lightsail|gce|azure|kube-pod>
      --profile=<value>            Run in a specific profile context (either an alias or a URL)
      --project-directory=<value>  Alternate working directory (default: the path of the first specified Compose file)

GLOBAL FLAGS
  -D, --debug                           Enable debug logging
  -f, --file=<value>...                 [default: ] Compose configuration file
  -p, --project=<value>                 Project name. Defaults to the Compose project name
      --disable-plugin=<value>...       Disable plugin with specified package name
      --enable-plugin=<value>...        [default: @preevy/plugin-github] Enable plugin with specified package name
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
  Execute a command or start an interactive shell inside an environment

ALIASES
  $ preevy ssh
```
