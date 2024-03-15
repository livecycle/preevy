import * as k8s from '@kubernetes/client-node'
import { Flags, Interfaces } from '@oclif/core'
import {
  MachineDriver,
  MachineDriverFactory,
  commandWith,
  execResultFromOrderedOutput,
  checkResult,
  expandStdioOptions,
  Logger,
  MachineConnection,
} from '@preevy/core'
import { asyncConcat, asyncMap } from 'iter-tools-es'
import { AddressInfo } from 'net'
import { Readable, Writable } from 'stream'
import { orderedOutput } from '@preevy/common'
import { CLIError } from '@oclif/core/lib/errors/index.js'
import { inspect } from 'util'
import { StatefulSetMachine, k8sObjectToMachine, DeploymentMachine } from './common.js'
import { Client, extractName, loadKubeConfig, kubeClient as createClient } from './client/index.js'
import { isValidRfc1123LabelName } from './client/labels.js'

export type DriverContext = {
  log: Logger
  debug: boolean
  client: Client
}

const isTTY = (s: Readable | Writable) => (s as unknown as { isTTY: boolean }).isTTY

export const machineConnection = async (
  client: Client,
  machine: StatefulSetMachine,
  log: Logger,
): Promise<MachineConnection> => {
  const { kubernetesObject: statefulSet } = machine as StatefulSetMachine
  log.debug(`Connecting to statefulset "${statefulSet.metadata?.namespace}/${statefulSet.metadata?.name}"`)
  const pod = await client.findReadyPod(statefulSet)
  log.debug(`Found pod "${pod.metadata?.name}"`)

  return ({
    [Symbol.dispose]: () => undefined,

    exec: async (command, opts) => {
      const { code, output } = await client.exec({
        pod: extractName(pod),
        container: pod.spec?.containers[0]?.name as string,
        command: ['sh', '-c', commandWith(command, opts ?? {})],
        stdin: opts?.stdin,
      })
      const result = {
        code,
        ...execResultFromOrderedOutput(orderedOutput(output)),
      }
      return opts?.ignoreExitCode ? result : checkResult(command, result)
    },

    dockerSocket: async () => {
      const host = '0.0.0.0'

      const {
        localSocket,
        [Symbol.asyncDispose]: dispose,
      } = await client.portForward(statefulSet, 2375, { host, port: 0 })

      return {
        address: { host, port: (localSocket as AddressInfo).port },
        [Symbol.asyncDispose]: dispose,
      }
    },
  })
}

export const listMachines = (
  { client }: { client: Client },
): AsyncIterableIterator<StatefulSetMachine | DeploymentMachine> => asyncMap(
  k8sObjectToMachine,
  asyncConcat<k8s.V1StatefulSet | k8s.V1Deployment>(
    client.listProfileStatefulSets(),
    client.listProfileDeployments(),
  ),
)

const machineDriver = (
  { client, log }: DriverContext,
): MachineDriver<StatefulSetMachine | DeploymentMachine> => ({
  friendlyName: 'Kubernetes single Pod',

  getMachine: async ({ envId }) => {
    const obj = await client.findEnvObject({ envId, deleted: false })
    return obj && k8sObjectToMachine(obj)
  },

  listMachines: () => listMachines({ client }),
  resourcePlurals: {},

  spawnRemoteCommand: async (machine, command, stdio) => {
    const pod = await client.findReadyPod((machine as StatefulSetMachine | DeploymentMachine).kubernetesObject)
    const { stdin, stdout, stderr } = expandStdioOptions(stdio)
    const opts = {
      pod: extractName(pod),
      container: pod.spec?.containers[0]?.name as string,
      command: command.length > 0 ? command : ['sh'],
      tty: [stdin, stdout, stderr].every(isTTY),
      stdin,
      stdout,
      stderr,
    }
    return await client.exec(opts)
  },

  connect: machine => machineConnection(client, machine as StatefulSetMachine, log),

  machineStatusCommand: async machine => {
    const pod = await client.findReadyPod((machine as StatefulSetMachine | DeploymentMachine).kubernetesObject)
    const apiServiceAddress = await client.apiServiceClusterAddress()
    if (!apiServiceAddress) {
      log.warn('API service not found for cluster')
      return undefined
    }
    const [apiServiceHost, apiServicePort] = apiServiceAddress

    return ({
      contentType: 'application/vnd.kubectl-top-pod-containers',
      recipe: {
        type: 'docker',
        command: ['top', 'pod', '--containers', '--no-headers', extractName(pod)],
        image: 'rancher/kubectl:v1.26.7',
        network: 'host',
        tty: false,
        env: {
          KUBERNETES_SERVICE_HOST: apiServiceHost,
          KUBERNETES_SERVICE_PORT: apiServicePort.toString(),
        },
        bindMounts: [
          '/var/run/secrets/kubernetes.io/serviceaccount:/var/run/secrets/kubernetes.io/serviceaccount',
        ],
      },
    })
  },
})

export const parseRfc1123Flag = async (v: unknown) => {
  if (v !== undefined && (typeof v !== 'string' || !isValidRfc1123LabelName(v))) {
    throw new CLIError(`Expected a valid lowercase RFC 1123 subdomain name but received: ${inspect(v)}`, {
      ref: 'https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#dns-label-names',
    })
  }
  return v
}

export const flags = {
  namespace: Flags.custom<string>({
    description: 'Kubernetes namespace in which resources will be provisioned (needs to exist)',
    required: false,
    default: 'default',
    parse: parseRfc1123Flag,
  })(),
  kubeconfig: Flags.string({
    description: 'Path to kubeconfig file (will load config from defaults if not specified)',
    required: false,
    env: 'KUBECONFIG',
  }),
  context: Flags.string({
    description: 'kubeconfig context name (will load config from defaults if not specified)',
    required: false,
    env: 'KUBE_CONTEXT',
  }),
} as const

type FlagTypes = Omit<Interfaces.InferredFlags<typeof flags>, 'json'>

export const clientFromConfiguration = ({ flags: f, profileId, log, kc }: {
  flags: Pick<FlagTypes, 'namespace' | 'kubeconfig' | 'context'>
  profileId: string
  log: Logger
  kc: k8s.KubeConfig
}) => createClient({
  log,
  namespace: f.namespace,
  kc,
  kubeconfig: f.kubeconfig,
  profileId,
})

export const factory: MachineDriverFactory<
  FlagTypes,
  StatefulSetMachine | DeploymentMachine
> = ({ flags: f, profile: { id: profileId }, log, debug }) => machineDriver({
  log,
  debug,
  client: clientFromConfiguration({ log, flags: f, profileId, kc: loadKubeConfig(f) }),
})
