`preevy up`
===========

Bring up a preview environment

* [`preevy up [SERVICE]`](#preevy-up-service)

## `preevy up [SERVICE]`

Bring up a preview environment

```
USAGE
  $ preevy up [SERVICE] [-D] [-f <value>] [--system-compose-file <value>] [-p <value>] [-d
    lightsail|gce|azure|kube-pod] [--lightsail-region us-east-2|us-east-1|us-west-2|ap-south-1|ap-northeast-2|ap-southea
    st-1|ap-southeast-2|ap-northeast-1|ca-central-1|eu-central-1|eu-west-1|eu-west-2|eu-west-3|eu-north-1]
    [--gce-project-id <value>] [--gce-zone <value>] [--azure-region <value>] [--azure-subscription-id <value>]
    [--kube-pod-namespace <value>] [--kube-pod-kubeconfig <value>] [--kube-pod-context <value>] [--kube-pod-template
    <value>] [--lightsail-availability-zone <value>] [--lightsail-bundle-id
    nano_2_0|micro_2_0|small_2_0|medium_2_0|large_2_0|xlarge_2_0|2xlarge_2_0] [--gce-machine-type <value>]
    [--azure-vm-size <value>] [--azure-resource-group-name <value>] [--kube-pod-server-side-apply] [--id <value>] [-t
    <value>] [--tls-hostname <value>] [--insecure-skip-verify] [--skip-unchanged-files] [--include-access-credentials]
    [--columns <value> | -x] [--sort <value>] [--filter <value>] [--output csv|json|yaml |  | [--csv | --no-truncate]]
    [--no-header | ]

ARGUMENTS
  SERVICE  Service name(s). If not specified, will deploy all services

FLAGS
  -d, --driver=<option>         Machine driver to use
                                <options: lightsail|gce|azure|kube-pod>
  -t, --tunnel-url=<value>      [default: ssh+tls://livecycle.run] Tunnel url, specify ssh://hostname[:port] or
                                ssh+tls://hostname[:port]
  -x, --extended                show extra columns
  --columns=<value>             only show provided columns (comma-separated)
  --csv                         output is csv format [alias: --output=csv]
  --filter=<value>              filter property by partial string matching, ex: name=foo
  --id=<value>                  Environment id - affects created URLs. If not specified, will try to detect
                                automatically
  --include-access-credentials  Include access credentials for basic auth for each service URL
  --insecure-skip-verify        Skip TLS or SSH certificate verification
  --no-header                   hide table header from output
  --no-truncate                 do not truncate output to fit screen
  --output=<option>             output in a more machine friendly format
                                <options: csv|json|yaml>
  --[no-]skip-unchanged-files   Detect and skip unchanged files when copying (default: true)
  --sort=<value>                property to sort by (prepend '-' for descending)
  --tls-hostname=<value>        Override TLS server name when tunneling via HTTPS

GLOBAL FLAGS
  -D, --debug                       Enable debug logging
  -f, --file=<value>...             [default: ] Compose configuration file
  -p, --project=<value>             Project name. Defaults to the Compose project name
  --system-compose-file=<value>...  [default: ] Add extra Compose configuration file without overriding the defaults

AZURE DRIVER FLAGS
  --azure-region=<value>               Microsoft Azure region in which resources will be provisioned
  --azure-resource-group-name=<value>  Microsoft Azure resource group name
  --azure-subscription-id=<value>      Microsoft Azure subscription id
  --azure-vm-size=<value>              [default: Standard_B2s] Machine type to be provisioned

GCE DRIVER FLAGS
  --gce-machine-type=<value>  Machine type to be provisioned
  --gce-project-id=<value>    Google Cloud project ID
  --gce-zone=<value>          Google Cloud zone in which resources will be provisioned

KUBE-POD DRIVER FLAGS
  --kube-pod-context=<value>         Path to kubeconfig file (will load config from defaults if not specified)
  --kube-pod-kubeconfig=<value>      Path to kubeconfig file (will load config from defaults if not specified)
  --kube-pod-namespace=<value>       [default: default] Kubernetes namespace in which resources will be provisioned
                                     (needs to exist)
  --[no-]kube-pod-server-side-apply  Use server side apply to create Kubernetes resources
  --kube-pod-template=<value>        Path to custom resources template file (will use default template if not specified)

LIGHTSAIL DRIVER FLAGS
  --lightsail-availability-zone=<value>  AWS availability zone to provision resources in region
  --lightsail-bundle-id=<option>         Lightsail bundle ID (size of instance) to provision. Default: medium_2_0
                                         <options:
                                         nano_2_0|micro_2_0|small_2_0|medium_2_0|large_2_0|xlarge_2_0|2xlarge_2_0>
  --lightsail-region=<option>            AWS region in which resources will be provisioned
                                         <options: us-east-2|us-east-1|us-west-2|ap-south-1|ap-northeast-2|ap-southeast-
                                         1|ap-southeast-2|ap-northeast-1|ca-central-1|eu-central-1|eu-west-1|eu-west-2|e
                                         u-west-3|eu-north-1>

DESCRIPTION
  Bring up a preview environment
```

_See code: [dist/commands/up.ts](https://github.com/livecycle/preevy/blob/v0.0.42/packages/cli/src/commands/up.ts)_
