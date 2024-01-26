import { Flags, Interfaces } from '@oclif/core'
import { asyncMap } from 'iter-tools-es'
import * as inquirer from '@inquirer/prompts'
import inquirerAutoComplete from 'inquirer-autocomplete-standalone'
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
import { pick } from 'lodash-es'
import createClient, { Client, Instance, availableRegions, defaultProjectId, instanceError, shortResourceName } from './client.js'
import { deserializeMetadata, metadataKey } from './metadata.js'
import { LABELS } from './labels.js'

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

const listMachines = ({ client }: { client: Client }) => asyncMap(machineFromInstance, client.listInstances())

const machineDriver = ({ store, client }: DriverContext): MachineDriver<SshMachine> => ({
  friendlyName: 'Google Cloud',

  getMachine: async ({ envId }) => {
    const instance = await client.findBestEnvInstance(envId)
    return instance && machineFromInstance(instance)
  },

  listMachines: () => listMachines({ client }),

  resourcePlurals: {},
  ...sshDriver({ getSshKey: () => getStoredSshKey(store, SSH_KEYPAIR_ALIAS) }),
  machineStatusCommand: async () => machineStatusNodeExporterCommand,
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

const inquireFlags = async ({ log: _log }: { log: Logger }) => {
  const project = await inquirer.input({
    default: await defaultProjectId(),
    message: flags['project-id'].description as string,
  })

  const regionsForProject = await availableRegions(project)
  const region = await inquirerAutoComplete<string>({
    source: async input => regionsForProject
      .filter(({ name }) => !input || name.includes(input.toLowerCase()))
      .map(({ name }) => ({ value: name })),
    transformer: i => i.toLowerCase(),
    message: 'Region',
  })

  const zones = regionsForProject.find(({ name }) => name === region)?.zones
  if (!zones) {
    throw new Error(`No zones for region "${region}" in project "${project}"`)
  }

  const zone = await inquirer.select<string>({
    message: flags.zone.description as string,
    choices: zones.map(value => ({ value })),
  })

  return { 'project-id': project, zone }
}

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
): MachineCreationDriver<SshMachine, ResourceType> => {
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

    listDeletableResources: () => listMachines({ client }),

    deleteResources: async (wait, ...resources) => {
      await Promise.all(resources.map(({ type, providerId }) => {
        if (type === 'machine') {
          return client.deleteInstance(providerId, wait)
        }
        throw new Error(`Unknown resource type: "${type}"`)
      }))
    },
  })
}

const factory: MachineDriverFactory<
  Interfaces.InferredFlags<typeof flags>,
  SshMachine
> = ({ flags: f, profile: { id: profileId }, store, log, debug }) => machineDriver({
  log,
  debug,
  client: createClient({ ...contextFromFlags(f), profileId }),
  store,
})
machineDriver.factory = factory

const machineCreationFactory: MachineCreationDriverFactory<
  Interfaces.InferredFlags<typeof machineCreationFlags>,
  SshMachine,
  ResourceType
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
  inquireFlags,
} as const

export { defaultProjectId } from './client.js'
