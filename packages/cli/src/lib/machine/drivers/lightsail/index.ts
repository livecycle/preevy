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
  bundleId: string
  profileId: string
}

const machineDriver = ({
  region,
  availabilityZone,
  bundleId,
  profileId,
}: DriverContext): MachineDriver => {
  const client = createClient({ region, profileId })
  const keyAlias = `${region}`
  return {
    friendlyName: 'AWS Lightsail',

    getMachine: async ({ envId }) => {
      const instance = await client.findInstance(envId)
      return instance && {
        ...machineFromInstance(instance),
        specDiff: bundleId === instance.bundleId
          ? []
          : [{ name: 'bundle-id', old: instance.bundleId as string, new: bundleId }],
      }
    },

    listMachines: () => asyncMap(
      machineFromInstance,
      client.listInstances(),
    ),

    getKeyPairAlias: async () => keyAlias,

    createKeyPair: async () => {
      const keyPair = await client.createKeyPair({
        alias: keyAlias,
      })
      return {
        alias: keyAlias,
        ...keyPair,
      }
    },

    createMachine: async ({ envId, keyConfig }) => {
      const instanceSnapshot = await client.findInstanceSnapshot({ version: CURRENT_MACHINE_VERSION, bundleId })
      const keyPair = await client.findKeyPairByAlias(keyConfig.alias)
      if (!keyPair || !keyPair.name) {
        throw new Error(`Key pair not found for alias: ${keyConfig.alias}`)
      }
      const instance = await client.createInstance({
        bundleId,
        instanceSnapshotName: instanceSnapshot?.name,
        availabilityZone,
        name: `preevy-${envId}-${randomBytes(16).toString('hex')}`,
        envId,
        versionTag: CURRENT_MACHINE_VERSION,
        keyPairName: keyPair.name,
      })

      return { ...machineFromInstance(instance), fromSnapshot: instanceSnapshot !== undefined }
    },

    ensureMachineSnapshot: async ({ driverMachineId: providerId, envId, wait }) => {
      const instanceSnapshot = await client.findInstanceSnapshot({ version: CURRENT_MACHINE_VERSION, bundleId })
      if (instanceSnapshot) {
        return undefined
      }
      await client.createInstanceSnapshot({
        instanceSnapshotName: `preevy-${CURRENT_MACHINE_VERSION}-${bundleId}-${randomBytes(16).toString('hex')}`,
        envId,
        instanceName: providerId,
        version: CURRENT_MACHINE_VERSION,
        wait,
      })
      return undefined
    },

    removeMachine: providerId => client.deleteInstance(providerId),
  }
}

const BUNDLE_IDS = [
  'nano_2_0',
  'micro_2_0',
  'small_2_0',
  'medium_2_0',
  'large_2_0',
  'xlarge_2_0',
  '2xlarge_2_0',
  'nano_win_2_0',
  'micro_win_2_0',
  'small_win_2_0',
  'medium_win_2_0',
  'large_win_2_0',
  'xlarge_win_2_0',
  '2xlarge_win_2_0',
]

const REGIONS = [
  'us-east-2',
  'us-east-1',
  'us-west-2',
  'ap-south-1',
  'ap-northeast-2',
  'ap-southeast-1',
  'ap-southeast-2',
  'ap-northeast-1',
  'ca-central-1',
  'eu-central-1',
  'eu-west-1',
  'eu-west-2',
  'eu-west-3',
  'eu-north-1',
]

machineDriver.flags = {
  region: Flags.string({
    description: 'AWS region in which resources will be provisioned',
    required: true,
    env: 'AWS_REGION',
    options: REGIONS,
  }),
  'availability-zone': Flags.string({
    description: 'AWS availability zone to provision resources in region',
    required: false,
    env: 'AWS_AVAILABILITY_ZONE',
  }),
  'bundle-id': Flags.string({
    description: 'Lightsail bundle ID ',
    required: false,
    default: 'medium_2_0',
    options: BUNDLE_IDS,
  }),
} as const

type FlagTypes = InferredFlags<typeof machineDriver.flags>
machineDriver.flagHint = <TFlagKey extends keyof FlagTypes>(flag:TFlagKey): FlagTypes[TFlagKey] | undefined => {
  if (flag === 'region') {
    return 'us-east-1' as FlagTypes[TFlagKey]
  }
  return undefined
}

const factory: MachineDriverFactory<Interfaces.InferredFlags<typeof machineDriver.flags>> = (
  f,
  profile,
) => machineDriver({
  region: f.region as string,
  availabilityZone: f['availability-zone'],
  bundleId: f['bundle-id'],
  profileId: profile.id,
})
machineDriver.factory = factory

export default machineDriver
