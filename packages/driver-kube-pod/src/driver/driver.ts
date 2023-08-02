import fs from 'fs'
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
import { asyncMap } from 'iter-tools-es'
import { AddressInfo } from 'net'
import { Readable, Writable } from 'stream'
import { orderedOutput } from '@preevy/common'
import { DeploymentMachine, ResourceType, machineFromDeployment } from './common'
import createClient, { Client, extractName, loadKubeConfig } from './client'
import { PACKAGE_JSON, DEFAULT_TEMPLATE } from '../static'

export type DriverContext = {
  log: Logger
  debug: boolean
  client: Client
}

const isTTY = (s: Readable | Writable) => (s as unknown as { isTTY: boolean }).isTTY

export const machineConnection = async (
  client: Client,
  machine: DeploymentMachine,
): Promise<MachineConnection> => {
  const { deployment } = machine as DeploymentMachine
  const pod = await client.findReadyPodForDeployment(deployment)

  return ({
    close: async () => undefined,

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
      const { localSocket, close } = await client.portForward(deployment, 2375, { host, port: 0 })
      return {
        address: { host, port: (localSocket as AddressInfo).port },
        close,
      }
    },
  })
}

const machineDriver = (
  { client }: DriverContext,
): MachineDriver<DeploymentMachine, ResourceType> => ({
  friendlyName: 'Kubernetes single Pod',

  getMachine: async ({ envId }) => {
    const deployment = await client.findMostRecentDeployment({ envId, deleted: false })
    return deployment && machineFromDeployment(deployment)
  },

  listDeletableResources: () => asyncMap(machineFromDeployment, client.listProfileDeployments()),

  deleteResources: async (wait, ...resources) => {
    await Promise.all(resources.map(({ type, providerId }) => {
      if (type === 'machine') {
        return client.deleteEnv(providerId, { wait })
      }
      throw new Error(`Unknown resource type: "${type}"`)
    }))
  },

  resourcePlurals: {},

  spawnRemoteCommand: async (machine, command, stdio) => {
    const pod = await client.findReadyPodForDeployment((machine as DeploymentMachine).deployment)
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

  connect: machine => machineConnection(client, machine as DeploymentMachine),
})

export const flags = {
  namespace: Flags.string({
    description: 'Kubernetes namespace in which resources will be provisioned (needs to exist)',
    required: false,
    default: 'default',
  }),
  kubeconfig: Flags.string({
    description: 'Path to kubeconfig file (will load config from defaults if not specified)',
    required: false,
    env: 'KUBECONFIG',
  }),
  context: Flags.string({
    description: 'Path to kubeconfig file (will load config from defaults if not specified)',
    required: false,
    env: 'KUBE_CONTEXT',
  }),
  template: Flags.string({
    description: 'Path to custom resources template file (will use default template if not specified)',
    required: false,
  }),
} as const

type FlagTypes = Omit<Interfaces.InferredFlags<typeof flags>, 'json'>

export const clientFromConfiguration = ({ flags: f, profileId, log }: {
  flags: Pick<FlagTypes, 'namespace' | 'kubeconfig' | 'template' | 'context'>
  profileId: string
  log: Logger
}) => createClient({
  log,
  namespace: f.namespace,
  kc: loadKubeConfig(f.kubeconfig, f.context),
  kubeconfig: f.kubeconfig,
  profileId,
  package: fs.promises.readFile(PACKAGE_JSON, 'utf-8').then(JSON.parse),
  template: fs.promises.readFile(f.template || DEFAULT_TEMPLATE, 'utf-8'),
})

export const factory: MachineDriverFactory<
  FlagTypes,
  DeploymentMachine,
  ResourceType
> = ({ flags: f, profile: { id: profileId }, log, debug }) => machineDriver({
  log,
  debug,
  client: clientFromConfiguration({ log, flags: f, profileId }),
})
