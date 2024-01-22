import fs from 'fs'
import * as k8s from '@kubernetes/client-node'
import { Flags, Interfaces } from '@oclif/core'
import { Logger, MachineCreationDriver, MachineCreationDriverFactory, telemetryEmitter } from '@preevy/core'
import { pick } from 'lodash-es'
import { DeploymentMachine, ResourceType, StatefulSetMachine, k8sObjectToMachine } from './common.js'
import { clientFromConfiguration, listMachines, machineConnection, flags as machineDriverFlags } from './driver.js'
import { Client, CreationClient, kubeCreationClient, loadKubeConfig } from './client/index.js'
import { DEFAULT_TEMPLATE, packageJson } from '../static.js'

export const flags = {
  ...machineDriverFlags,
  template: Flags.string({
    description: 'Path to custom resources template file (will use default template if not specified)',
    required: false,
  }),
  'server-side-apply': Flags.boolean({
    description: 'Use server side apply to create Kubernetes resources',
    default: true,
    required: false,
    allowNo: true,
  }),
  'storage-class': Flags.string({
    description: 'Storage class to use for Pod data volume',
    required: false,
  }),
  'storage-size': Flags.custom<number>({
    description: 'Size of Pod data volume in GiB',
    required: false,
    default: 5,
    parse: async v => Number(v),
  })(),
} as const

export type MachineCreationFlagTypes = Omit<Interfaces.InferredFlags<typeof flags>, 'json'>

const machineCreationDriver = (
  { client, creationClient, serverSideApply, log, metadata }: {
    log: Logger
    serverSideApply: boolean
    metadata: MachineCreationFlagTypes
    client: Client
    creationClient: CreationClient
  },
): MachineCreationDriver<StatefulSetMachine | DeploymentMachine, ResourceType> => ({
  metadata,
  createMachine: async ({ envId }) => {
    const startTime = new Date().getTime()
    telemetryEmitter().capture('kube-pod create machine start', {})

    return ({
      fromSnapshot: true,
      result: (async () => {
        log.debug('create machine', { envId, serverSideApply })
        const statefulSet = await creationClient.createEnv(envId, { serverSideApply })
        const machine = k8sObjectToMachine(statefulSet)
        telemetryEmitter().capture('kube-pod create machine end', { elapsed_sec: (new Date().getTime() - startTime) / 1000 })
        const connection = await machineConnection(client, machine, log)
        return { machine, connection }
      })(),
    })
  },

  ensureMachineSnapshot: async () => undefined,
  getMachineAndSpecDiff: async ({ envId }) => {
    const obj = await client.findEnvObject({ envId, deleted: false })
    if (!obj) {
      return undefined
    }

    const deployedHash = creationClient.extractTemplateHash(obj)
    const machine = k8sObjectToMachine(obj)
    const templateHash = await creationClient.calcTemplateHash({ instance: machine.providerId })

    return {
      ...machine,
      specDiff: deployedHash !== templateHash
        ? [{ name: 'template', old: deployedHash, new: templateHash }]
        : [],
    }
  },
  listDeletableResources: () => listMachines({ client }),

  deleteResources: async (wait, ...resources) => {
    await Promise.all(resources.map(({ type, providerId }) => {
      if (type === 'machine') {
        return creationClient.deleteEnv(providerId, { wait })
      }
      throw new Error(`Unknown resource type: "${type}"`)
    }))
  },

})

type FlagTypes = Omit<Interfaces.InferredFlags<typeof flags>, 'json'>

const creationClientFromConfiguration = ({ flags: f, profileId, log, kc }: {
  flags: FlagTypes
  profileId: string
  log: Logger
  kc: k8s.KubeConfig
}) => kubeCreationClient({
  log,
  namespace: f.namespace,
  kc,
  profileId,
  package: packageJson,
  template: fs.readFileSync(f.template || DEFAULT_TEMPLATE, 'utf-8'),
  storageClass: f['storage-class'],
  storageSize: f['storage-size'],
})

export const factory: MachineCreationDriverFactory<
  Interfaces.InferredFlags<typeof flags>,
  StatefulSetMachine | DeploymentMachine,
  ResourceType
> = ({ flags: f, profile: { id: profileId }, log }) => {
  const kc = loadKubeConfig(f)
  return machineCreationDriver({
    metadata: pick(f, Object.keys(machineDriverFlags)) as MachineCreationFlagTypes, // filter out non-driver flags
    log,
    client: clientFromConfiguration({ log, flags: f, profileId, kc }),
    serverSideApply: f['server-side-apply'],
    creationClient: creationClientFromConfiguration({ log, flags: f, profileId, kc }),
  })
}

export default machineCreationDriver
