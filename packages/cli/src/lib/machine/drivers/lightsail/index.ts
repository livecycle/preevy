import {
  Instance,
} from '@aws-sdk/client-lightsail'
import { asyncMap } from 'iter-tools-es'

import { Flags } from '@oclif/core'
import { randomBytes } from 'crypto'
import { InferredFlags } from '@oclif/core/lib/interfaces'
import { extractDefined } from '../../../aws-utils/nulls'
import { Machine, MachineDriver } from '../../driver'
import createClient, { REGIONS } from './client'
import { BUNDLE_IDS, BundleId, bundleIdFromString } from './bundle-id'
import { CUSTOMIZE_BARE_MACHINE } from './scripts'
import { CURRENT_MACHINE_VERSION, TAGS, requiredTag } from './tags'
import { MachineCreationDriver, MachineCreationDriverFactory, MachineDriverFactory } from '../../driver/driver'
import { telemetryEmitter } from '../../../telemetry'

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
  profileId: string
}

const machineDriver = ({
  region,
  profileId,
}: DriverContext): MachineDriver => {
  const client = createClient({ region, profileId })
  const keyAlias = `${region}`
  return {
    friendlyName: 'AWS Lightsail',
    customizationScripts: CUSTOMIZE_BARE_MACHINE,

    getMachine: async ({ envId }) => {
      const instance = await client.findInstance(envId)
      return instance && machineFromInstance(instance)
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
} as const

type FlagTypes = InferredFlags<typeof machineDriver.flags>

const contextFromFlags = (flags: FlagTypes): Omit<DriverContext, 'profileId'> => ({
  region: flags.region as string,
})

machineDriver.flagHint = <TFlagKey extends keyof FlagTypes>(flag:TFlagKey): FlagTypes[TFlagKey] | undefined => {
  if (flag === 'region') {
    return 'us-east-1' as FlagTypes[TFlagKey]
  }
  return undefined
}

const factory: MachineDriverFactory<FlagTypes> = (
  f,
  profile,
) => machineDriver({
  ...contextFromFlags(f),
  profileId: profile.id,
})

machineDriver.factory = factory

type MachineCreationContext = DriverContext & {
  availabilityZone?: string
  bundleId?: BundleId
}

const DEFAULT_BUNDLE_ID: BundleId = 'medium_2_0'

const machineCreationDriver = (
  context: MachineCreationContext
): MachineCreationDriver => {
  const { region, profileId, availabilityZone, bundleId: specifiedBundleId } = context
  const client = createClient({ region, profileId })
  const bundleId = specifiedBundleId ?? DEFAULT_BUNDLE_ID

  return ({
    getMachineAndSpecDiff: async ({ envId }) => {
      const instance = await client.findInstance(envId)
      return instance && {
        ...machineFromInstance(instance),
        specDiff: specifiedBundleId && specifiedBundleId !== instance.bundleId
          ? [{ name: 'bundle-id', old: instance.bundleId as string, new: specifiedBundleId }]
          : [],
      }
    },

    createMachine: async ({ envId, keyConfig }) => {
      const instanceSnapshot = await client.findInstanceSnapshot({ version: CURRENT_MACHINE_VERSION, bundleId })
      const haveSnapshot = instanceSnapshot?.state === 'available'
      const startTime = new Date().getTime()
      telemetryEmitter().capture('aws lightsail create machine start', { region, bundle_id: bundleId, have_snapshot: haveSnapshot })
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

          telemetryEmitter().capture('aws lightsail create machine end', { region, bundle_id: bundleId, have_snapshot: haveSnapshot, elapsed_sec: (new Date().getTime() - startTime) / 1000 })
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
  })
}

machineDriver.machineCreationFlags = {
  ...machineDriver.flags,
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
}

type MachineCreationFlagTypes = InferredFlags<typeof machineDriver.machineCreationFlags>

const machineCreationContextFromFlags = (flags: MachineCreationFlagTypes): Omit<MachineCreationContext, 'profileId'> => ({
  ...contextFromFlags(flags),
  availabilityZone: flags['availability-zone'] as string,
  bundleId: flags['bundle-id'] as BundleId,
})

const machineCreationFactory: MachineCreationDriverFactory<MachineCreationFlagTypes> = (
  f,
  profile,
) => machineCreationDriver({
  ...machineCreationContextFromFlags(f),
  profileId: profile.id,
})

machineDriver.machineCreationFactory = machineCreationFactory

export default machineDriver
