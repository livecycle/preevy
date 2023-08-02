import { Flags, Interfaces } from '@oclif/core'
import { asyncMap } from 'iter-tools-es'
import { InputQuestion, ListQuestion } from 'inquirer'
import {
  MachineDriver,
  SshMachine, MachineCreationDriver, MachineCreationDriverFactory, MachineDriverFactory,
  telemetryEmitter,
  Store,
  getStoredSshKey,
  sshKeysStore,
  sshDriver,
  machineResourceType,
  Logger,
  machineStatusNodeExporterCommand,
} from '@preevy/core'
import createClient, { Client, Instance, availableRegions, defaultProjectId, shortResourceName } from './client'
import { LABELS } from './labels'

type DriverContext = {
  log: Logger
  debug: boolean
  client: Client
  store: Store
}

type MachineCreationDriverContext = DriverContext & {
  machineType?: string
}

type ResourceType = typeof machineResourceType

const SSH_KEYPAIR_ALIAS = 'preevy-gce'
const SSH_USERNAME = 'preevy'

const DEFAULT_MACHINE_TYPE = 'e2-small'

const machineFromInstance = (
  instance: Instance,
): SshMachine & { envId: string } => {
  const publicIPAddress = instance.networkInterfaces?.[0].accessConfigs?.[0].natIP as string
  return {
    type: machineResourceType,
    locationDescription: publicIPAddress,
    publicIPAddress,
    sshKeyName: SSH_KEYPAIR_ALIAS,
    sshUsername: SSH_USERNAME,
    providerId: instance.name as string,
    version: '',
    envId: instance.labels?.[LABELS.ENV_ID] as string,
  }
}

const machineDriver = (
  { store, client }: DriverContext,
): MachineDriver<SshMachine, ResourceType> => ({
  friendlyName: 'Google Cloud',

  getMachine: async ({ envId }) => {
    const instance = await client.findInstance(envId)
    return instance && machineFromInstance(instance)
  },

  listDeletableResources: () => asyncMap(machineFromInstance, client.listInstances()),
  deleteResources: async (wait, ...resources) => {
    await Promise.all(resources.map(({ type, providerId }) => {
      if (type === 'machine') {
        return client.deleteInstance(providerId, wait)
      }
      throw new Error(`Unknown resource type: "${type}"`)
    }))
  },

  resourcePlurals: {},

  ...sshDriver({ getSshKey: () => getStoredSshKey(store, SSH_KEYPAIR_ALIAS) }),

  machineStatusCommand: machineStatusNodeExporterCommand,
})

const flags = {
  'project-id': Flags.string({
    description: 'Google Cloud project ID',
    required: true,
  }),
  zone: Flags.string({
    description: 'Google Cloud zone in which resources will be provisioned',
    required: true,
  }),
} as const

type FlagTypes = Omit<Interfaces.InferredFlags<typeof flags>, 'json'>

const contextFromFlags = ({
  'project-id': projectId,
  zone,
}: FlagTypes): { projectId: string; zone: string } => ({
  projectId,
  zone,
})

const questions = async (): Promise<(InputQuestion | ListQuestion)[]> => [
  {
    type: 'input',
    name: 'project',
    default: defaultProjectId,
    message: flags['project-id'].description,
  },
  {
    type: 'list',
    name: 'region',
    choices: async ({ project }) => (await availableRegions(project)).map(r => r.name),
  },
  {
    type: 'list',
    name: 'zone',
    choices: async (
      { project, region },
    ) => (await availableRegions(project)).find(r => r.name === region)?.zones ?? [],
  },
]

const flagsFromAnswers = async (answers: Record<string, unknown>): Promise<FlagTypes> => ({
  'project-id': answers.project as string,
  zone: answers.zone as string,
})

const machineCreationDriver = (
  { machineType: specifiedMachineType, store, client, log, debug }: MachineCreationDriverContext,
): MachineCreationDriver<SshMachine> => {
  const machineType = specifiedMachineType || DEFAULT_MACHINE_TYPE
  const ssh = sshDriver({ getSshKey: () => getStoredSshKey(store, SSH_KEYPAIR_ALIAS) })

  return ({
    createMachine: async ({ envId }) => {
      const startTime = new Date().getTime()
      telemetryEmitter().capture('google compute engine create machine start', { machine_type: machineType })

      return ({
        fromSnapshot: true,
        result: (
          async () => {
            const instance = await client.createInstance({
              envId,
              sshPublicKey: await sshKeysStore(store).upsertKey(SSH_KEYPAIR_ALIAS),
              machineType,
              username: SSH_USERNAME,
            })
            telemetryEmitter().capture('google compute engine create machine end', { machine_type: machineType, elapsed_sec: (new Date().getTime() - startTime) / 1000 })
            const machine = machineFromInstance(instance)
            return {
              machine,
              connection: await ssh.connect(
                machine,
                { log, debug, retryOpts: { minTimeout: 2000, maxTimeout: 5000, retries: 10 } },
              ),
            }
          }
        )(),
      })
    },

    ensureMachineSnapshot: async () => undefined,
    getMachineAndSpecDiff: async ({ envId }) => {
      const instance = await client.findInstance(envId)
      if (!instance) {
        return undefined
      }

      const instanceMachineType = instance.machineType as string

      return instance && {
        ...machineFromInstance(instance),
        specDiff: specifiedMachineType && instanceMachineType !== client.normalizeMachineType(specifiedMachineType)
          ? [{ name: 'machine-type', old: shortResourceName(instanceMachineType), new: shortResourceName(specifiedMachineType) }]
          : [],
      }
    },
  })
}

const machineCreationFlags = {
  ...flags,
  'machine-type': Flags.string({
    description: 'Machine type to be provisioned',
    required: false,
  }),
} as const

const machineCreationContextFromFlags = (
  fl: Interfaces.InferredFlags<typeof machineCreationFlags>
): ReturnType<typeof contextFromFlags> & { machineType?: string } => ({
  ...contextFromFlags(fl),
  machineType: fl['machine-type'],
})

const factory: MachineDriverFactory<
  Interfaces.InferredFlags<typeof flags>,
  SshMachine,
  ResourceType
> = ({ flags: f, profile: { id: profileId }, store, log, debug }) => machineDriver({
  log,
  debug,
  client: createClient({ ...contextFromFlags(f), profileId }),
  store,
})
machineDriver.factory = factory

const machineCreationFactory: MachineCreationDriverFactory<
  Interfaces.InferredFlags<typeof machineCreationFlags>,
  SshMachine
> = ({ flags: f, profile: { id: profileId }, store, log, debug }) => machineCreationDriver({
  log,
  debug,
  ...machineCreationContextFromFlags(f),
  client: createClient({ ...contextFromFlags(f), profileId }),
  store,
})

export default {
  flags,
  factory,
  machineCreationFlags,
  machineCreationFactory,
  questions,
  flagsFromAnswers,
} as const

export { defaultProjectId } from './client'
