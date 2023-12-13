import { Flags, Interfaces } from '@oclif/core'
import { asyncMap } from 'iter-tools-es'
import inquirer, { ListQuestion, Question } from 'inquirer'
import inquirerAutoComplete from 'inquirer-autocomplete-prompt'
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
  extractDefined,
  PartialMachine,
} from '@preevy/core'
import { memoize, pick } from 'lodash-es'
import createClient, { Client, Instance, availableRegions, defaultProjectId, instanceError, shortResourceName } from './client.js'
import { deserializeMetadata, metadataKey } from './metadata.js'
import { LABELS } from './labels.js'

inquirer.registerPrompt('autocomplete', inquirerAutoComplete)

type DriverContext = {
  log: Logger
  debug: boolean
  client: Client
  store: Store
}

type ResourceType = typeof machineResourceType

const SSH_KEYPAIR_ALIAS = 'preevy-gce'
const SSH_USERNAME = 'preevy'

const DEFAULT_MACHINE_TYPE = 'e2-small'

const envIdFromInstance = ({ metadata, labels }: Pick<Instance, 'metadata' | 'labels'>) => {
  const metadataItemValue = metadata?.items?.find(({ key }) => key === metadataKey)?.value
  return metadataItemValue
    ? deserializeMetadata(metadataItemValue).envId
    : extractDefined(labels ?? {}, LABELS.OLD_ENV_ID) // backwards compat
}

const machineFromInstance = (
  instance: Instance,
): (PartialMachine | SshMachine) & { envId: string } => {
  const publicIPAddress = instance.networkInterfaces?.[0].accessConfigs?.[0].natIP as string
  return {
    type: machineResourceType,
    locationDescription: publicIPAddress,
    publicIPAddress,
    sshKeyName: SSH_KEYPAIR_ALIAS,
    sshUsername: SSH_USERNAME,
    providerId: instance.name as string,
    version: '',
    envId: envIdFromInstance(instance),
    ...instanceError(instance),
  }
}

const machineDriver = ({ store, client }: DriverContext): MachineDriver<SshMachine, ResourceType> => {
  const listMachines = () => asyncMap(machineFromInstance, client.listInstances())

  return ({
    friendlyName: 'Google Cloud',

    getMachine: async ({ envId }) => {
      const instance = await client.findBestEnvInstance(envId)
      return instance && machineFromInstance(instance)
    },

    listMachines,
    listDeletableResources: listMachines,

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
    machineStatusCommand: async () => machineStatusNodeExporterCommand,
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

type FlagTypes = Omit<Interfaces.InferredFlags<typeof flags>, 'json'>

const contextFromFlags = ({
  'project-id': projectId,
  zone,
}: FlagTypes): { projectId: string; zone: string } => ({
  projectId,
  zone,
})

const questions = async (): Promise<Question[]> => {
  const memoizedAvailableRegions = memoize(availableRegions)
  return [
    {
      type: 'input',
      name: 'project',
      default: defaultProjectId,
      message: flags['project-id'].description,
    },
    {
      type: 'autocomplete',
      name: 'region',
      source: async ({ project }, input) => (await memoizedAvailableRegions(project))
        .filter(({ name }) => !input || name.includes(input.toLowerCase()))
        .map(r => r.name),
      filter: i => i.toLowerCase(),
    } as inquirerAutoComplete.AutocompleteQuestionOptions,
    {
      type: 'list',
      name: 'zone',
      choices: memoize(
        async ({ project, region }) => (await availableRegions(project)).find(r => r.name === region)?.zones ?? [],
      ),
    } as ListQuestion,
  ]
}

const flagsFromAnswers = async (answers: Record<string, unknown>): Promise<FlagTypes> => ({
  'project-id': answers.project as string,
  zone: answers.zone as string,
})

const machineCreationFlags = {
  ...flags,
  'machine-type': Flags.string({
    description: 'Machine type to be provisioned',
    required: false,
  }),
} as const

type MachineCreationFlagTypes = Omit<Interfaces.InferredFlags<typeof machineCreationFlags>, 'json'>

const machineCreationContextFromFlags = (
  fl: MachineCreationFlagTypes
): ReturnType<typeof contextFromFlags> & { machineType?: string } => ({
  ...contextFromFlags(fl),
  machineType: fl['machine-type'],
})

type MachineCreationDriverContext = DriverContext & {
  machineType?: string
  metadata: MachineCreationFlagTypes
}

const machineCreationDriver = (
  { machineType: specifiedMachineType, store, client, log, debug, metadata }: MachineCreationDriverContext,
): MachineCreationDriver<SshMachine> => {
  const machineType = specifiedMachineType || DEFAULT_MACHINE_TYPE
  const ssh = sshDriver({ getSshKey: () => getStoredSshKey(store, SSH_KEYPAIR_ALIAS) })

  return ({
    metadata,
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
            const machine = machineFromInstance(instance) as SshMachine
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
      const instance = await client.findBestEnvInstance(envId)
      if (!instance) {
        return undefined
      }

      const instanceMachineType = instance.machineType as string

      return {
        ...machineFromInstance(instance),
        specDiff: specifiedMachineType && instanceMachineType !== client.normalizeMachineType(specifiedMachineType)
          ? [{ name: 'machine-type', old: shortResourceName(instanceMachineType), new: shortResourceName(specifiedMachineType) }]
          : [],
      }
    },
  })
}

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
  metadata: pick(f, Object.keys(machineCreationFlags)) as MachineCreationFlagTypes, // filter out non-driver flags
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

export { defaultProjectId } from './client.js'
