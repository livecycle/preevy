import { Flags, Interfaces } from '@oclif/core'
import { asyncMap } from 'iter-tools-es'
import { InputQuestion, ListQuestion } from 'inquirer'
import {
  MachineDriver,
  SshMachine, MachineCreationDriver, MachineCreationDriverFactory, MachineDriverFactory,
  telemetryEmitter,
  generateSshKeyPair,
  Store,
  getStoredSshKey,
  sshKeysStore,
  sshDriver,
  machineResourceType,
} from '@preevy/core'
import createClient, { Instance, availableRegions, defaultProjectId, shortResourceName } from './client'
import { LABELS } from './labels'

type DriverContext = {
  profileId: string
  store: Store
  projectId: string
  zone: string
}

type MachineCreationDriverContext = DriverContext & {
  machineType?: string
  store: Store
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
  { zone, projectId, profileId, store }: DriverContext,
): MachineDriver<SshMachine, ResourceType> => {
  const client = createClient({ zone, project: projectId, profileId })
  return ({
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

    ...sshDriver(() => getStoredSshKey(store, SSH_KEYPAIR_ALIAS)),
  })
}

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

machineDriver.flags = flags

type FlagTypes = Omit<Interfaces.InferredFlags<typeof machineDriver.flags>, 'json'>

const contextFromFlags = ({ 'project-id': projectId, zone }: FlagTypes): Omit<DriverContext, 'profileId' | 'store'> => ({
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

machineDriver.questions = questions

const flagsFromAnswers = async (answers: Record<string, unknown>): Promise<FlagTypes> => ({
  'project-id': answers.project as string,
  zone: answers.zone as string,
})

machineDriver.flagsFromAnswers = flagsFromAnswers

const machineCreationDriver = (
  { zone, projectId, profileId, machineType: specifiedMachineType, store }: MachineCreationDriverContext,
): MachineCreationDriver<SshMachine> => {
  const machineType = specifiedMachineType || DEFAULT_MACHINE_TYPE
  const client = createClient({ zone, project: projectId, profileId })

  const ensureStoredKeyPairPublicKey = async () => {
    const keyStore = sshKeysStore(store)
    let storedKeyPair = await keyStore.getKey(SSH_KEYPAIR_ALIAS)
    if (!storedKeyPair) {
      const newKeyPair = await generateSshKeyPair()
      storedKeyPair = {
        alias: SSH_KEYPAIR_ALIAS,
        ...newKeyPair,
      }
      await keyStore.addKey(storedKeyPair)
    }

    return storedKeyPair.publicKey.toString('utf-8')
  }

  return ({
    createMachine: async ({ envId }) => {
      const startTime = new Date().getTime()
      telemetryEmitter().capture('google compute engine create machine start', { zone, machine_type: machineType })

      return ({
        fromSnapshot: true,
        machine: (
          async () => {
            const instance = await client.createInstance({
              envId,
              sshPublicKey: await ensureStoredKeyPairPublicKey(),
              machineType,
              username: SSH_USERNAME,
            })
            telemetryEmitter().capture('google compute engine create machine end', { zone, machine_type: machineType, elapsed_sec: (new Date().getTime() - startTime) / 1000 })
            return machineFromInstance(instance)
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

machineDriver.machineCreationFlags = {
  ...machineDriver.flags,
  'machine-type': Flags.string({
    description: 'Machine type to be provisioned',
    required: false,
  }),
} as const

const machineCreationContextFromFlags = (
  fl: Interfaces.InferredFlags<typeof machineDriver.machineCreationFlags>
): Omit<MachineCreationDriverContext, 'profileId' | 'store'> => ({
  ...contextFromFlags(fl),
  machineType: fl['machine-type'],
})

const factory: MachineDriverFactory<
  Interfaces.InferredFlags<typeof machineDriver.flags>,
  SshMachine,
  ResourceType
> = (f, profile, store) => machineDriver({ ...contextFromFlags(f), profileId: profile.id, store })
machineDriver.factory = factory

const machineCreationFactory: MachineCreationDriverFactory<
  Interfaces.InferredFlags<typeof machineDriver.machineCreationFlags>,
  SshMachine
> = (f, profile, store) => machineCreationDriver({
  ...machineCreationContextFromFlags(f),
  profileId: profile.id,
  store,
})

machineDriver.machineCreationFactory = machineCreationFactory

export default machineDriver

export { defaultProjectId } from './client'
