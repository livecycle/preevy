import {
  Instance,
} from '@aws-sdk/client-lightsail'
import { asyncMap } from 'iter-tools-es'

import { Flags, Interfaces } from '@oclif/core'
import { randomBytes } from 'crypto'
import { InferredFlags } from '@oclif/core/lib/interfaces'
import { extractDefined } from '../../../aws-utils/nulls'
import { Machine, MachineDriver } from '../../driver'
import createClient from './client'
import { CURRENT_MACHINE_VERSION, INSTANCE_TAGS, requiredTag } from './tags'
import { MachineDriverFactory } from '../../driver/driver'

const machineFromInstance = (
  instance: Instance,
): Machine & { envId: string } => ({
  privateIPAddress: extractDefined(instance, 'privateIpAddress'),
  publicIPAddress: extractDefined(instance, 'publicIpAddress'),
  sshKeyName: extractDefined(instance, 'sshKeyName'),
  sshUsername: 'ubuntu',
  providerId: extractDefined(instance, 'name'),
  version: requiredTag(instance.tags || [], INSTANCE_TAGS.MACHINE_VERSION),
  envId: requiredTag(instance.tags || [], INSTANCE_TAGS.ENV_ID),
})

type DriverContext = {
  region: string
  availabilityZone?: string
  profileId: string

}

const machineDriver = ({
  region,
  availabilityZone,
  profileId,
}: DriverContext): MachineDriver => {
  const client = createClient({ region, profileId })
  const keyAlias = `${region}`
  return {
    getMachine: async ({ envId }) => {
      const instance = await client.findInstance(envId)
      return instance && machineFromInstance(instance)
    },

    listMachines: () => asyncMap(
      machineFromInstance,
      client.listInstances(),
    ),

    getKeyPairAlias: async () => keyAlias,

    createKeyPair: async () => {
      const keyPair = await client.createKeyPair({
        alias: `${region}`,
      })
      return {
        alias: keyAlias,
        ...keyPair,
      }
    },

    createMachine: async ({ envId, keyConfig }) => {
      const instanceSnapshot = await client.findInstanceSnapshot({ version: CURRENT_MACHINE_VERSION })
      const keyPair = await client.findKeyPairByAlias(keyConfig.alias)
      if (!keyPair || !keyPair.name) {
        throw new Error(`Key pair not found for alias: ${keyConfig.alias}`)
      }
      const instance = await client.createInstance({
        instanceSnapshotName: instanceSnapshot?.name,
        availabilityZone,
        name: `preview-${envId}-${randomBytes(16).toString('hex')}`,
        envId,
        versionTag: CURRENT_MACHINE_VERSION,
        keyPairName: keyPair.name,
      })

      return { ...machineFromInstance(instance), fromSnapshot: instanceSnapshot !== undefined }
    },

    ensureMachineSnapshot: async ({ driverMachineId: providerId, envId }) => {
      const instanceSnapshot = await client.findInstanceSnapshot({ version: CURRENT_MACHINE_VERSION })
      if (instanceSnapshot) {
        return undefined
      }
      // creating instance snapshot in background
      await client.createInstanceSnapshot({
        instanceSnapshotName: `preview-${CURRENT_MACHINE_VERSION}-${randomBytes(16).toString('hex')}`,
        envId,
        instanceName: providerId,
        version: CURRENT_MACHINE_VERSION,
      })
      return undefined
    },

    removeMachine: providerId => client.deleteInstance(providerId),
  }
}

machineDriver.flags = {
  region: Flags.string({
    description: 'AWS region to provision resources in',
    required: true,
    env: 'AWS_REGION',
    options: ['us-east-2', 'us-east-1', 'us-west-2', 'ap-south-1', 'ap-northeast-2', 'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1', 'ca-central-1', 'eu-central-1', 'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-north-1'],
  }),
  'availability-zone': Flags.string({
    description: 'AWS availability zone to provision resources in region',
    required: false,
    env: 'AWS_AVAILABILITY_ZONE',
  }),
} as const

type FlagTypes = InferredFlags<typeof machineDriver.flags>
machineDriver.flagHint = <TFlagKey extends keyof FlagTypes>(flag:TFlagKey): FlagTypes[TFlagKey] | undefined => {
  if (flag === 'region') {
    return 'us-east-1' as FlagTypes[TFlagKey]
  }
  return undefined
}

const factory: MachineDriverFactory<Interfaces.InferredFlags<typeof machineDriver.flags>> = (f, profile) => machineDriver({ region: f.region as string, availabilityZone: f['availability-zone'], profileId: profile.id })
machineDriver.factory = factory

export default machineDriver
