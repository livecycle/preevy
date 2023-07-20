`preevy down`
=============

Delete preview environments

* [`preevy down`](#preevy-down)

## `preevy down`

Delete preview environments

```
USAGE
  $ preevy down [-D] [-f <value>] [--system-compose-file <value>] [-p <value>] [-d
    lightsail|gce|azure|kube-pod] [--lightsail-region us-east-2|us-east-1|us-west-2|ap-south-1|ap-northeast-2|ap-southea
    st-1|ap-southeast-2|ap-northeast-1|ca-central-1|eu-central-1|eu-west-1|eu-west-2|eu-west-3|eu-north-1]
    [--gce-project-id <value>] [--gce-zone <value>] [--azure-region <value>] [--azure-subscription-id <value>]
    [--kube-pod-namespace <value>] [--kube-pod-kubeconfig <value>] [--kube-pod-context <value>] [--kube-pod-template
    <value>] [--id <value>] [--force] [--wait] [--json]

FLAGS
  -d, --driver=<option>  Machine driver to use
                         <options: lightsail|gce|azure|kube-pod>
  --force                Do not error if the environment is not found
  --id=<value>           Environment id - affects created URLs. If not specified, will try to detect automatically
  --wait                 Wait for resource deletion to complete. If false (the default), the deletion will be started
                         but not waited for

GLOBAL FLAGS
  -D, --debug                       Enable debug logging
  -f, --file=<value>...             [default: ] Compose configuration file
  -p, --project=<value>             Project name. Defaults to the Compose project name
  --json                            Format output as json.
  --system-compose-file=<value>...  [default: ] Add extra Compose configuration file without overriding the defaults

AZURE DRIVER FLAGS
  --azure-region=<value>           Microsoft Azure region in which resources will be provisioned
  --azure-subscription-id=<value>  Microsoft Azure subscription id

GCE DRIVER FLAGS
  --gce-project-id=<value>  Google Cloud project ID
  --gce-zone=<value>        Google Cloud zone in which resources will be provisioned

KUBE-POD DRIVER FLAGS
  --kube-pod-context=<value>     Path to kubeconfig file (will load config from defaults if not specified)
  --kube-pod-kubeconfig=<value>  Path to kubeconfig file (will load config from defaults if not specified)
  --kube-pod-namespace=<value>   [default: default] Kubernetes namespace in which resources will be provisioned (needs
                                 to exist)
  --kube-pod-template=<value>    Path to custom resources template file (will use default template if not specified)

LIGHTSAIL DRIVER FLAGS
  --lightsail-region=<option>  AWS region in which resources will be provisioned
                               <options: us-east-2|us-east-1|us-west-2|ap-south-1|ap-northeast-2|ap-southeast-1|ap-south
                               east-2|ap-northeast-1|ca-central-1|eu-central-1|eu-west-1|eu-west-2|eu-west-3|eu-north-1>

DESCRIPTION
  Delete preview environments
```

_See code: [dist/commands/down.ts](https://github.com/livecycle/preevy/blob/v0.0.42/packages/cli/src/commands/down.ts)_
