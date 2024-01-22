import { Flags, Interfaces } from '@oclif/core'
import { asyncFirst, asyncMap } from 'iter-tools-es'
import * as inquirer from '@inquirer/prompts'
import inquirerAutoComplete from 'inquirer-autocomplete-standalone'
import { InferredFlags } from '@oclif/core/lib/interfaces'
import { Resource, VirtualMachine } from '@azure/arm-compute'
import { inspect } from 'util'
import { DefaultAzureCredential } from '@azure/identity'
import { SubscriptionClient } from '@azure/arm-subscriptions'
import {
  SshMachine,
  MachineCreationDriver,
  MachineCreationDriverFactory,
  MachineDriver,
  MachineDriverFactory,
  telemetryEmitter,
  Store,
  sshKeysStore,
  sshDriver,
  getStoredSshKey,
  machineResourceType,
  Logger,
  machineStatusNodeExporterCommand,
} from '@preevy/core'
import { pick } from 'lodash-es'
import { Client, client as createClient, REGIONS } from './client.js'
import { CUSTOMIZE_BARE_MACHINE } from './scripts.js'
import { AzureCustomTags, extractResourceGroupNameFromId } from './vm-creation-utils.js'

type RootObjectDetailsError = {
  code: string
  message: string
}
type RootObjectDetails = {
  error: RootObjectDetailsError
}

export type AzureErrorResponse = {
  details: RootObjectDetails
  name: string
  code: string
  statusCode: number
  message: string
}

type ResourceType = typeof machineResourceType

type DriverContext = {
  client: Client
  log: Logger
  debug: boolean
  store: Store
}

const UBUNTU_IMAGE_DETAILS = {
  publisher: 'Canonical',
  offer: '0001-com-ubuntu-server-jammy',
  sku: '22_04-lts-gen2',
}

const requireTagValue = (tags: Resource['tags'], key: string) => {
  if (!tags?.[key]) {
    throw new Error(`Could not find required tag ${key} in ${inspect(tags)}`)
  }
  return tags[key]
}

const SSH_KEYPAIR_ALIAS = 'azure' as const

const machineFromVm = (
  { publicIPAddress, vm }: {
    publicIPAddress: string
    vm: VirtualMachine}
): SshMachine & { envId: string } => {
  if (!vm.id || !vm.osProfile?.adminUsername) {
    throw new Error('Could not create a machine from instance')
  }
  return {
    type: machineResourceType,
    locationDescription: publicIPAddress,
    publicIPAddress,
    providerId: extractResourceGroupNameFromId(vm.id),
    sshKeyName: SSH_KEYPAIR_ALIAS,
    sshUsername: vm.osProfile.adminUsername,
    version: '',
    envId: requireTagValue(vm.tags, AzureCustomTags.ENV_ID),
  }
}

const listMachines = ({ client: cl }: { client: Client }) => asyncMap(
  rg => cl.getInstanceByRg(rg.name as string).then(vm => {
    if (vm) {
      return machineFromVm(vm)
    }
    return {
      type: machineResourceType,
      providerId: rg.name as string,
      envId: rg.tags?.[AzureCustomTags.ENV_ID] as string,
      error: 'VM creation is incomplete',
    }
  }),
  cl.listResourceGroups()
)

const machineDriver = (
  { store, client: cl }: DriverContext,
): MachineDriver<SshMachine> => ({
  customizationScripts: CUSTOMIZE_BARE_MACHINE,
  friendlyName: 'Microsoft Azure',
  getMachine: async ({ envId }) => await cl.getInstance(envId).then(vm => machineFromVm(vm)),
  listMachines: () => listMachines({ client: cl }),
  resourcePlurals: {},
  ...sshDriver({ getSshKey: () => getStoredSshKey(store, SSH_KEYPAIR_ALIAS) }),
  machineStatusCommand: async () => machineStatusNodeExporterCommand,
})

const flags = {
  region: Flags.string({
    description: 'Microsoft Azure region in which resources will be provisioned',
    required: true,
  }),
  'subscription-id': Flags.string({
    description: 'Microsoft Azure subscription id',
    required: true,
  }),
} as const

type FlagTypes = Omit<Interfaces.InferredFlags<typeof flags>, 'json'>

const inquireFlags = async ({ log: _log }: { log: Logger }) => {
  const region = await inquirerAutoComplete<string>({
    message: flags.region.description as string,
    source: async input => REGIONS.filter(r => !input || r.includes(input.toLowerCase())).map(value => ({ value })),
    suggestOnly: true,
    transformer: i => i.toLowerCase(),
  })

  const credential = new DefaultAzureCredential()
  const subscriptionClient = new SubscriptionClient(credential)
  const defaultSubscriptionId = (await asyncFirst(subscriptionClient.subscriptions.list()))?.subscriptionId

  const subscriptionId = await inquirer.input({
    message: flags['subscription-id'].description as string,
    default: defaultSubscriptionId,
  })

  return { region, 'subscription-id': subscriptionId }
}

const contextFromFlags = ({
  region,
  'subscription-id': subscriptionId,
}: FlagTypes): { region: string; subscriptionId: string } => ({
  region,
  subscriptionId,
})

const DEFAULT_VM_SIZE = 'Standard_B2s'

const machineCreationFlags = {
  ...flags,
  'vm-size': Flags.string({
    description: 'Machine type to be provisioned',
    default: DEFAULT_VM_SIZE,
    required: false,
  }),
} as const

type MachineCreationFlagTypes = Omit<InferredFlags<typeof machineCreationFlags>, 'json'>

type MachineCreationContext = DriverContext & {
  vmSize?: string
  metadata: MachineCreationFlagTypes
}

const machineCreationDriver = (
  { client: cl, vmSize, store, log, debug, metadata }: MachineCreationContext,
): MachineCreationDriver<SshMachine, ResourceType> => {
  const ssh = sshDriver({ getSshKey: () => getStoredSshKey(store, SSH_KEYPAIR_ALIAS) })

  return {
    metadata,
    createMachine: async ({ envId }) => ({
      fromSnapshot: false,
      result: (async () => {
        const startTime = new Date().getTime()
        telemetryEmitter().capture('azure create machine start', { })

        const {
          publicIPAddress,
          vm,
        } = await cl.createVMInstance({
          imageRef: UBUNTU_IMAGE_DETAILS,
          sshPublicKey: await sshKeysStore(store).upsertKey(SSH_KEYPAIR_ALIAS, 'rsa'),
          vmSize: vmSize ?? DEFAULT_VM_SIZE,
          envId,
        })
        telemetryEmitter().capture('azure create machine end', { elapsed_sec: (new Date().getTime() - startTime) / 1000 })

        const machine = machineFromVm({ publicIPAddress, vm })
        return {
          machine,
          connection: await ssh.connect(
            machine,
            { log, debug, retryOpts: { minTimeout: 2000, maxTimeout: 5000, retries: 10 } },
          ),
        }
      })(),
    }),
    ensureMachineSnapshot: async () => undefined,
    getMachineAndSpecDiff: async ({ envId }) => {
      const vmInstance = await cl.getInstance(envId).catch((e: AzureErrorResponse) => {
        if (e.statusCode === 404) {
          return undefined
        }
        throw e
      })
      if (!vmInstance) {
        return undefined
      }
      return ({
        ...machineFromVm(vmInstance),
        specDiff: vmSize && vmSize !== vmInstance.vm.hardwareProfile?.vmSize
          ? [{ name: 'vm-size', old: vmInstance.vm.hardwareProfile?.vmSize as string, new: vmSize }]
          : [],
      })
    },
    listDeletableResources: () => listMachines({ client: cl }),
    deleteResources: async (wait, ...resources) => {
      await Promise.all(resources.map(({ type, providerId }) => {
        if (type === machineResourceType) {
          return cl.deleteResourcesResourceGroup(providerId, wait)
        }
        throw new Error(`Unknown resource type "${type}"`)
      }))
    },
  }
}

const factory: MachineDriverFactory<
  Interfaces.InferredFlags<typeof flags>,
  SshMachine
> = ({ flags: f, profile: { id: profileId }, store, log, debug }) => machineDriver({
  client: createClient({
    ...contextFromFlags(f),
    profileId,
  }),
  log,
  debug,
  store,
})

const machineCreationContextFromFlags = (
  f: MachineCreationFlagTypes,
): ReturnType<typeof contextFromFlags> & { vmSize: string } => ({
  ...contextFromFlags(f),
  vmSize: f['vm-size'],
})

const machineCreationFactory: MachineCreationDriverFactory<
  MachineCreationFlagTypes,
  SshMachine,
  ResourceType
> = ({ flags: f, profile: { id: profileId }, store, log, debug }) => {
  const c = machineCreationContextFromFlags(f)
  return machineCreationDriver({
    metadata: pick(f, Object.keys(machineCreationFlags)) as MachineCreationFlagTypes, // filter out non-driver flags
    client: createClient({
      ...c,
      profileId,
    }),
    log,
    debug,
    ...c,
    store,
  })
}

export default {
  flags,
  factory,
  machineCreationFlags,
  machineCreationFactory,
  inquireFlags,
} as const
