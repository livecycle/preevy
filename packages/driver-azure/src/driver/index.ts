import { Flags, Interfaces } from '@oclif/core'
import { asyncFirst, asyncMap } from 'iter-tools-es'
import { ListQuestion, Question } from 'inquirer'
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
} from '@preevy/core'
import { client, REGIONS } from './client'
import { CUSTOMIZE_BARE_MACHINE } from './scripts'
import { AzureCustomTags, extractResourceGroupNameFromId } from './vm-creation-utils'

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
  profileId: string
  store: Store
  region: string
  subscriptionId: string
}

type MachineCreationContext = DriverContext & {
  vmSize?: string
  resourceGroupId: string
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

const SSH_KEYPAIR_ALIAS = 'default' as const

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

const machineDriver = (
  { region, subscriptionId, profileId, store }: DriverContext,
): MachineDriver<SshMachine, ResourceType> => {
  const cl = client({
    region,
    subscriptionId,
    profileId,
  })

  return {
    customizationScripts: CUSTOMIZE_BARE_MACHINE,
    friendlyName: 'Microsoft Azure',
    getMachine: async ({ envId }) => cl.getInstance(envId).then(vm => machineFromVm(vm)),

    listDeletableResources: () => asyncMap(
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
    ),

    deleteResources: async (wait, ...resources) => {
      await Promise.all(resources.map(({ type, providerId }) => {
        if (type === machineResourceType) {
          return cl.deleteResourcesResourceGroup(providerId, wait)
        }
        throw new Error(`Unknown resource type "${type}"`)
      }))
    },

    resourcePlurals: {},

    ...sshDriver({ getSshKey: () => getStoredSshKey(store, SSH_KEYPAIR_ALIAS) }),
  }
}
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

machineDriver.flags = flags

machineDriver.questions = async (): Promise<(Question | ListQuestion)[]> => [
  {
    type: 'list',
    name: 'region',
    message: flags.region.description,
    choices: REGIONS,
  },
  {
    type: 'input',
    name: 'subscription-id',
    default: async () => {
      const credential = new DefaultAzureCredential()
      const subscriptionClient = new SubscriptionClient(credential)
      const subscription = await asyncFirst(subscriptionClient.subscriptions.list())
      return subscription?.subscriptionId || ''
    },
    message: flags['subscription-id'].description,
  },
]

machineDriver.flagsFromAnswers = async (answers: Record<string, unknown>) => ({
  region: answers.region,
  'subscription-id': answers['subscription-id'],

})

const contextFromFlags = ({
  region,
  'subscription-id': subscriptionId,
}: Interfaces.InferredFlags<typeof machineDriver.flags>): Omit<DriverContext, 'profileId' | 'store'> => ({
  region,
  subscriptionId,
})

const DEFAULT_VM_SIZE = 'Standard_B2s'

const machineCreationDriver = ({
  region,
  profileId,
  subscriptionId,
  vmSize,
  store,
}: MachineCreationContext): MachineCreationDriver<SshMachine> => {
  const cl = client({ region, subscriptionId, profileId })

  return {
    createMachine: async ({ envId }) => ({
      fromSnapshot: false,
      machine: (async () => {
        const startTime = new Date().getTime()
        telemetryEmitter().capture('azure create machine start', { region })

        const {
          publicIPAddress,
          vm,
        } = await cl.createVMInstance({
          imageRef: UBUNTU_IMAGE_DETAILS,
          sshPublicKey: await sshKeysStore(store).upsertKey(SSH_KEYPAIR_ALIAS),
          vmSize: vmSize ?? DEFAULT_VM_SIZE,
          envId,
        })
        telemetryEmitter().capture('azure create machine end', { region, elapsed_sec: (new Date().getTime() - startTime) / 1000 })
        return machineFromVm({ publicIPAddress, vm })
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
  }
}

machineDriver.machineCreationFlags = {
  ...machineDriver.flags,
  region: Flags.string({
    description: 'Microsoft Azure region in which resources will be provisioned',
    required: true,
  }),
  'vm-size': Flags.string({
    description: 'Machine type to be provisioned',
    default: DEFAULT_VM_SIZE,
    required: false,
  }),
  'resource-group-name': Flags.string({
    description: 'Microsoft Azure resource group name',
    required: true,
  }),
} as const

type MachineCreationFlagTypes = InferredFlags<typeof machineDriver.machineCreationFlags>

const machineCreationContextFromFlags = (f: MachineCreationFlagTypes): Omit<MachineCreationContext, 'profileId' | 'store'> => ({
  ...contextFromFlags(f),
  region: f.region,
  vmSize: f['vm-size'],
  resourceGroupId: f['resource-group-name'],
})

const factory: MachineDriverFactory<
  Interfaces.InferredFlags<typeof machineDriver.flags>,
  SshMachine,
  ResourceType
> = (f, { id }, store) => machineDriver({ profileId: id, ...contextFromFlags(f), store })

machineDriver.factory = factory

const machineCreationFactory: MachineCreationDriverFactory<
  Interfaces.InferredFlags<typeof machineDriver.machineCreationFlags>,
  SshMachine
> = (f, { id }, store) => machineCreationDriver({ profileId: id, ...machineCreationContextFromFlags(f), store })

machineDriver.machineCreationFactory = machineCreationFactory

export default machineDriver
