import { Flags, Interfaces } from '@oclif/core'
import { asyncFirst, asyncMap } from 'iter-tools-es'
import { ListQuestion, Question } from 'inquirer'
import { InferredFlags } from '@oclif/core/lib/interfaces'
import { Resource, VirtualMachine } from '@azure/arm-compute'
import { inspect } from 'util'
import { DefaultAzureCredential } from '@azure/identity'
import { SubscriptionClient } from '@azure/arm-subscriptions'
import {
  generateSshKeyPair,
  Machine,
  MachineCreationDriver, MachineCreationDriverFactory,
  MachineDriver,
  MachineDriverFactory,
  telemetryEmitter,
} from '@preevy/core'
import { client, REGIONS } from './client'
import { AzureErrorResponse } from './types'
import { CUSTOMIZE_BARE_MACHINE } from './scripts'

type DriverContext = {
  profileId: string
  region: string
  subscriptionId: string
}

type MachineCreationContext = DriverContext & {
  vmSize?: string
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

const machineFromInstance = (
  { privateIPAddress, publicIPAddress, vm }: {
    privateIPAddress: string
    publicIPAddress: string
    vm: VirtualMachine}
): Machine & { envId: string } => {
  if (!vm.name || !vm.osProfile?.adminUsername) {
    throw new Error('Could not create a VM')
  }
  return {
    privateIPAddress,
    publicIPAddress,
    providerId: vm.name,
    sshKeyName: 'default',
    sshUsername: vm.osProfile.adminUsername,
    version: '',
    envId: requireTagValue(vm.tags, 'envId'),
  }
}

const machineDriver = ({ region, subscriptionId, profileId }: DriverContext): MachineDriver => {
  const cl = client({
    region,
    subscriptionId,
    profileId,
  })

  return {
    customizationScripts: CUSTOMIZE_BARE_MACHINE,
    friendlyName: 'Microsoft Azure',
    getMachine: async ({ envId }) => cl.getInstance(envId).then(vm => machineFromInstance(vm)),

    listMachines: () => asyncMap(machineFromInstance, cl.listInstances()),
    listSnapshots: () => asyncMap(x => x, []),
    createKeyPair: async () => {
    // https://learn.microsoft.com/en-us/rest/api/compute/ssh-public-keys/generate-key-pair?tabs=HTTP
      const keyPair = await generateSshKeyPair()
      return {
        ...keyPair,
        alias: 'default',
      }
    },

    removeMachine: async (driverMachineId, wait, envId) => cl.deleteInstance(driverMachineId, wait, envId),
    removeSnapshot: async () => undefined,
    removeKeyPair: async () => undefined,

    getKeyPairAlias: async () => 'default',
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
  'resource-group-name': Flags.string({
    description: 'Microsoft Azure resource group name',
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
}: Interfaces.InferredFlags<typeof machineDriver.flags>): Omit<DriverContext, 'profileId'> => ({
  region,
  subscriptionId,
})

const DEFAULT_VM_SIZE = 'Standard_B2s'
const machineCreationDriver = (
  {
    region,
    profileId,
    subscriptionId,
    vmSize,
  }: MachineCreationContext
): MachineCreationDriver => {
  const cl = client({
    region,
    subscriptionId,
    profileId,
  })
  return {
    createMachine: async ({
      envId,
      keyConfig,
    }) => ({
      fromSnapshot: false,
      machine: (async () => {
        const startTime = new Date().getTime()
        telemetryEmitter()
          .capture('azure create machine start', { region })

        const {
          privateIPAddress,
          publicIPAddress,
          vm,
        } = await cl.createVMInstance({
          imageRef: UBUNTU_IMAGE_DETAILS,
          sshPublicKey: keyConfig.publicKey.toString(),
          vmSize: vmSize ?? DEFAULT_VM_SIZE,
          envId,
        })
        telemetryEmitter().capture('azure create machine end', { region, elapsed_sec: (new Date().getTime() - startTime) / 1000 })
        return machineFromInstance({ privateIPAddress, publicIPAddress, vm })
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
        ...machineFromInstance(vmInstance),
        specDiff: [],
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
} as const

type MachineCreationFlagTypes = InferredFlags<typeof machineDriver.machineCreationFlags>

const machineCreationContextFromFlags = (f: MachineCreationFlagTypes): Omit<MachineCreationContext, 'profileId'> => ({
  ...contextFromFlags(f),
  region: f.region,
  vmSize: f['vm-size'],
})

const factory: MachineDriverFactory<
  Interfaces.InferredFlags<typeof machineDriver.flags>
> = (f, { id }) => machineDriver({ profileId: id, ...contextFromFlags(f) })
machineDriver.factory = factory

const machineCreationFactory: MachineCreationDriverFactory<
  Interfaces.InferredFlags<typeof machineDriver.machineCreationFlags>
> = (f, { id }) => machineCreationDriver({ profileId: id, ...machineCreationContextFromFlags(f) })

machineDriver.machineCreationFactory = machineCreationFactory

export default machineDriver
