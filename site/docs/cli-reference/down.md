`preevy down`
=============

Delete preview environments

* [`preevy down`](#preevy-down)

## `preevy down`

Delete preview environments

```
USAGE
  $ preevy down [--json] [-D] [-f <value>] [--system-compose-file <value>] [-p <value>] [--enable-plugin
    <value>] [--disable-plugin <value>] [--profile <value>] [-d lightsail|gce|azure|kube-pod] [--lightsail-region
    <value>] [--gce-project-id <value>] [--gce-zone <value>] [--azure-region <value>] [--azure-subscription-id <value>]
    [--kube-pod-namespace <value>] [--kube-pod-kubeconfig <value>] [--kube-pod-context <value>] [--kube-pod-template
    <value>] [--id <value>] [--force] [--wait] [--github-token <value>] [--github-repo <value>] [--github-pull-request
    <value>] [--github-pr-comment-template-file <value>] [--github-pr-comment-enabled auto|no|always]

FLAGS
  -d, --driver=<option>  Machine driver to use
                         <options: lightsail|gce|azure|kube-pod>
      --force            Do not error if the environment is not found
      --id=<value>       Environment id - affects created URLs. If not specified, will try to detect automatically
      --profile=<value>  Run in a specific profile context
      --wait             Wait for resource deletion to complete. If false (the default), the deletion will be started
                         but not waited for

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
  --azure-subscription-id=<value>  Microsoft Azure subscription id

GCE DRIVER FLAGS
  --gce-project-id=<value>  Google Cloud project ID
  --gce-zone=<value>        Google Cloud zone in which resources will be provisioned

GITHUB INTEGRATION FLAGS
  --github-pr-comment-enabled=<option>       [default: auto] Whether to enable posting to the GitHub PR
                                             <options: auto|no|always>
  --github-pr-comment-template-file=<value>  Path to nunjucks template file
  --github-pull-request=<value>              GitHub Pull Request number. Will auto-detect if not specified
  --github-repo=<value>                      GitHub repo name in the format owner/repo. Will auto-detect if not
                                             specified
  --github-token=<value>                     GitHub token with write access to the repo

KUBE-POD DRIVER FLAGS
  --kube-pod-context=<value>     kubeconfig context name (will load config from defaults if not specified)
  --kube-pod-kubeconfig=<value>  Path to kubeconfig file (will load config from defaults if not specified)
  --kube-pod-namespace=<value>   [default: default] Kubernetes namespace in which resources will be provisioned (needs
                                 to exist)
  --kube-pod-template=<value>    Path to custom resources template file (will use default template if not specified)

LIGHTSAIL DRIVER FLAGS
  --lightsail-region=<value>  AWS region in which resources will be provisioned

DESCRIPTION
  Delete preview environments
```

_See code: [src/commands/down.ts](https://github.com/livecycle/preevy/blob/v0.0.56/src/commands/down.ts)_
