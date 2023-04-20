import { Flags, Interfaces } from '@oclif/core'
import { asyncMap } from 'iter-tools-es'
import { generateSshKeyPair } from '../../../ssh/keypair'
import { MachineDriver } from '../../driver'
import { Machine, MachineCreationDriver, MachineCreationDriverFactory, MachineDriverFactory } from '../../driver/driver'
import createClient, { Instance, shortResourceName } from './client'
import { LABELS } from './labels'
import { telemetryEmitter } from '../../../telemetry'

type DriverContext = {
  profileId: string
  projectId: string
  zone: string
}

type MachineCreationDriverContext = DriverContext & {
  machineType?: string
}

const SSH_KEYPAIR_ALIAS = 'preevy-gce'
const SSH_USERNAME = 'preevy'

const DEFAULT_MACHINE_TYPE = 'e2-small'

const machineFromInstance = (
  instance: Instance,
): Machine & { envId: string } => ({
  privateIPAddress: instance.networkInterfaces?.[0].networkIP as string,
  publicIPAddress: instance.networkInterfaces?.[0].accessConfigs?.[0].natIP as string,
  sshKeyName: SSH_KEYPAIR_ALIAS,
  sshUsername: SSH_USERNAME,
  providerId: instance.name as string,
  version: '',
  envId: instance.labels?.[LABELS.ENV_ID] as string,
})

const machineDriver = ({ zone, projectId, profileId }: DriverContext): MachineDriver => {
  const client = createClient({ zone, project: projectId, profileId })
  return ({
    friendlyName: 'Google Cloud',

    getMachine: async ({ envId }) => {
      const instance = await client.findInstance(envId)
      return instance && machineFromInstance(instance)
    },

    listMachines: () => asyncMap(machineFromInstance, client.listInstances()),
    listSnapshots: () => asyncMap(x => x, []),

    createKeyPair: async () => ({
      ...(await generateSshKeyPair()),
      alias: SSH_KEYPAIR_ALIAS,
    }),

    removeMachine: async (driverMachineId, wait) => client.deleteInstance(driverMachineId, wait),
    removeSnapshot: async () => undefined,
    removeKeyPair: async () => undefined,
    getKeyPairAlias: async () => SSH_KEYPAIR_ALIAS,
  })
}

machineDriver.flags = {
  'project-id': Flags.string({
    description: 'Google Cloud project ID',
    required: true,
  }),
  zone: Flags.string({
    description: 'Google Cloud zone in which resources will be provisioned',
    required: true,
  }),
} as const

const contextFromFlags = (flags: Interfaces.InferredFlags<typeof machineDriver.flags>): Omit<DriverContext, 'profileId'> => ({
  projectId: flags['project-id'],
  zone: flags.zone,
})

const machineCreationDriver = (
  { zone, projectId, profileId, machineType: specifiedMachineType }: MachineCreationDriverContext,
): MachineCreationDriver => {
  const machineType = specifiedMachineType || DEFAULT_MACHINE_TYPE
  const client = createClient({ zone, project: projectId, profileId })
  return ({
    createMachine: async ({ envId, keyConfig }) => {
      const startTime = new Date().getTime()
      telemetryEmitter().capture('google compute engine create machine start', { zone, machine_type: machineType })

      return ({
        fromSnapshot: true,
        machine: (
          async () => {
            const instance = await client.createInstance({
              envId,
              sshPublicKey: keyConfig.publicKey.toString('utf-8'),
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
  flags: Interfaces.InferredFlags<typeof machineDriver.machineCreationFlags>
): Omit<MachineCreationDriverContext, 'profileId'> => ({
  ...contextFromFlags(flags),
  machineType: flags['machine-type'],
})

const factory: MachineDriverFactory<
  Interfaces.InferredFlags<typeof machineDriver.flags>
> = (f, profile) => machineDriver({ ...contextFromFlags(f), profileId: profile.id })
machineDriver.factory = factory

const machineCreationFactory: MachineCreationDriverFactory<
  Interfaces.InferredFlags<typeof machineDriver.machineCreationFlags>
> = (f, profile) => machineCreationDriver({ ...machineCreationContextFromFlags(f), profileId: profile.id })

machineDriver.machineCreationFactory = machineCreationFactory

export default machineDriver
