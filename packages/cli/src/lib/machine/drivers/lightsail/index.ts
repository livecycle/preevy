import {
  Instance,
} from '@aws-sdk/client-lightsail'
import { asyncMap } from 'iter-tools-es'

import { Flags, Interfaces } from '@oclif/core'
import { randomBytes } from 'crypto'
import { InferredFlags } from '@oclif/core/lib/interfaces'
import { extractDefined } from '../../../aws-utils/nulls'
import { Machine, MachineDriver } from '../../driver'
import createClient, { REGIONS } from './client'
import { BUNDLE_IDS, BundleId, bundleIdFromString } from './bundle-id'
import { CURRENT_MACHINE_VERSION, TAGS, requiredTag } from './tags'
import { MachineDriverFactory } from '../../driver/driver'

export { BundleId, BUNDLE_IDS, bundleIdFromString as bundleId }

const machineFromInstance = (
  instance: Instance,
): Machine & { envId: string } => ({
  privateIPAddress: extractDefined(instance, 'privateIpAddress'),
  publicIPAddress: extractDefined(instance, 'publicIpAddress'),
  sshKeyName: extractDefined(instance, 'sshKeyName'),
  sshUsername: 'ubuntu',
  providerId: extractDefined(instance, 'name'),
  version: requiredTag(instance.tags || [], TAGS.MACHINE_VERSION),
  envId: requiredTag(instance.tags || [], TAGS.ENV_ID),
})

type DriverContext = {
  region: string
  availabilityZone?: string
  bundleId?: BundleId
  profileId: string
}

const DEFAULT_BUNDLE_ID: BundleId = 'medium_2_0'

const machineDriver = ({
  region,
  availabilityZone,
  bundleId: specifiedBundleId,
  profileId,
}: DriverContext): MachineDriver => {
  const bundleId = specifiedBundleId ?? DEFAULT_BUNDLE_ID
  const client = createClient({ region, profileId })
  const keyAlias = `${region}`
  return {
    friendlyName: 'AWS Lightsail',

    getMachine: async ({ envId }) => {
      const instance = await client.findInstance(envId)
      return instance && {
        ...machineFromInstance(instance),
        specDiff: specifiedBundleId && specifiedBundleId !== instance.bundleId
          ? [{ name: 'bundle-id', old: instance.bundleId as string, new: specifiedBundleId }]
          : [],
      }
    },

    listMachines: () => asyncMap(
      machineFromInstance,
      client.listInstances(),
    ),

    listSnapshots: () => asyncMap(
      ({ name }) => ({ providerId: name as string }),
      client.listInstanceSnapshots(),
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
      const haveSnapshot = instanceSnapshot?.state === 'available'
      return {
        fromSnapshot: haveSnapshot,
        machine: (async () => {
          const keyPair = await client.findKeyPairByAlias(keyConfig.alias)
          if (!keyPair || !keyPair.name) {
            throw new Error(`Key pair not found for alias: ${keyConfig.alias} and profile ${profileId}`)
          }
          const instance = await client.createInstance({
            bundleId: bundleId ?? DEFAULT_BUNDLE_ID,
            instanceSnapshotName: haveSnapshot ? instanceSnapshot?.name : undefined,
            availabilityZone,
            name: `preevy-${envId}-${randomBytes(16).toString('hex')}`,
            envId,
            versionTag: CURRENT_MACHINE_VERSION,
            keyPairName: keyPair.name,
          })

          return machineFromInstance(instance)
        })(),
      }
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
    removeSnapshot: providerId => client.deleteInstanceSnapshot({ instanceSnapshotName: providerId }),
    removeKeyPair: async alias => { await client.deleteKeyPair(alias) },
  }
}

machineDriver.flags = {
  region: Flags.string({
    description: 'AWS region in which resources will be provisioned',
    required: true,
    env: 'AWS_REGION',
    options: REGIONS.map(r => r),
  }),
  'availability-zone': Flags.string({
    description: 'AWS availability zone to provision resources in region',
    required: false,
    env: 'AWS_AVAILABILITY_ZONE',
  }),
  'bundle-id': Flags.custom<BundleId>({
    description: `Lightsail bundle ID (size of instance) to provision. Default: ${DEFAULT_BUNDLE_ID}`,
    required: false,
    options: BUNDLE_IDS.map(b => b),
  })(),
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
