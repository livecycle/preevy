`preevy down`
=============

Delete preview environments

* [`preevy down`](#preevy-down)

## `preevy down`

Delete preview environments

```
USAGE
  $ preevy down [--json] [-D] [-f <value>] [--system-compose-file <value>] [--project-directory <value>]
    [-p <value>] [--enable-plugin <value>] [--disable-plugin <value>] [--profile <value>] [-d
    lightsail|gce|azure|kube-pod] [--lightsail-region <value>] [--gce-project-id <value>] [--gce-zone <value>]
    [--azure-region <value>] [--azure-subscription-id <value>] [--kube-pod-namespace <value>] [--kube-pod-kubeconfig
    <value>] [--kube-pod-context <value>] [--lightsail-availability-zone <value>] [--lightsail-bundle-id
    nano_2_0|micro_2_0|small_2_0|medium_2_0|large_2_0|xlarge_2_0|2xlarge_2_0] [--gce-machine-type <value>]
    [--azure-vm-size <value>] [--kube-pod-template <value>] [--kube-pod-server-side-apply] [--kube-pod-storage-class
    <value>] [--kube-pod-storage-size <value>] [--id <value>] [--force] [--wait] [--github-token <value>] [--github-repo
    <value>] [--github-pull-request <value>] [--github-pr-comment-template-file <value>] [--github-add-build-cache]
    [--github-pr-comment-enabled auto|no|always]

FLAGS
  -d, --driver=<option>            Machine driver to use
                                   <options: lightsail|gce|azure|kube-pod>
      --force                      Do not error if the environment is not found
      --id=<value>                 Environment id
      --profile=<value>            Run in a specific profile context (either an alias or a URL)
      --project-directory=<value>  Alternate working directory (default: the path of the first specified Compose file)
      --wait                       Wait for resource deletion to complete. If false (the default), the deletion will be
                                   started but not waited for

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
  --azure-vm-size=<value>          [default: Standard_B2s] Machine type to be provisioned

GCE DRIVER FLAGS
  --gce-machine-type=<value>  Machine type to be provisioned
  --gce-project-id=<value>    Google Cloud project ID
  --gce-zone=<value>          Google Cloud zone in which resources will be provisioned

GITHUB INTEGRATION FLAGS
  --github-add-build-cache                   Add github cache to the build
  --github-pr-comment-enabled=<option>       [default: auto] Whether to enable posting to the GitHub PR
                                             <options: auto|no|always>
  --github-pr-comment-template-file=<value>  Path to nunjucks template file
  --github-pull-request=<value>              GitHub Pull Request number. Will auto-detect if not specified
  --github-repo=<value>                      GitHub repo name in the format owner/repo. Will auto-detect if not
                                             specified
  --github-token=<value>                     GitHub token with write access to the repo

KUBE-POD DRIVER FLAGS
  --kube-pod-context=<value>         kubeconfig context name (will load config from defaults if not specified)
  --kube-pod-kubeconfig=<value>      Path to kubeconfig file (will load config from defaults if not specified)
  --kube-pod-namespace=<value>       [default: default] Kubernetes namespace in which resources will be provisioned
                                     (needs to exist)
  --[no-]kube-pod-server-side-apply  Use server side apply to create Kubernetes resources
  --kube-pod-storage-class=<value>   Storage class to use for Pod data volume
  --kube-pod-storage-size=<value>    [default: 5] Size of Pod data volume in GiB
  --kube-pod-template=<value>        Path to custom resources template file (will use default template if not specified)

LIGHTSAIL DRIVER FLAGS
  --lightsail-availability-zone=<value>  AWS availability zone to provision resources in region
  --lightsail-bundle-id=<option>         Lightsail bundle ID (size of instance) to provision. Default: medium_2_0
                                         <options:
                                         nano_2_0|micro_2_0|small_2_0|medium_2_0|large_2_0|xlarge_2_0|2xlarge_2_0>
  --lightsail-region=<value>             AWS region in which resources will be provisioned

DESCRIPTION
  Delete preview environments

FLAG DESCRIPTIONS
  --id=<value>  Environment id

    Affects created URLs
    If not specified, will detect from the current Git context
```

_See code: [src/commands/down.ts](https://github.com/livecycle/preevy/blob/v0.0.64/src/commands/down.ts)_
