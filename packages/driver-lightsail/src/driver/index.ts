import { Instance } from '@aws-sdk/client-lightsail'
import { asyncConcat, asyncMap } from 'iter-tools-es'

import { Flags } from '@oclif/core'
import { randomBytes } from 'crypto'
import { InferredFlags } from '@oclif/core/lib/interfaces'
import inquirerAutoComplete from 'inquirer-autocomplete-standalone'
import {
  telemetryEmitter,
  SshMachine, MachineDriver, MachineCreationDriver, MachineCreationDriverFactory, machineResourceType,
  MachineDriverFactory, sshKeysStore, Store,
  getStoredSshKey, sshDriver, extractDefined, Logger, machineStatusNodeExporterCommand,
} from '@preevy/core'
import { pick } from 'lodash-es'
import createClient, { Client, REGIONS } from './client.js'
import { BUNDLE_IDS, BundleId, bundleIdFromString } from './bundle-id.js'
import { CUSTOMIZE_BARE_MACHINE } from './scripts.js'
import { CURRENT_MACHINE_VERSION, TAGS, requiredTag } from './tags.js'

export { BundleId, BUNDLE_IDS, bundleIdFromString as bundleId }

type ResourceType = typeof machineResourceType | 'snapshot' | 'keypair'

const machineFromInstance = (
  instance: Instance,
): SshMachine & { envId: string } => ({
  type: machineResourceType,
  locationDescription: extractDefined(instance, 'publicIpAddress'),
  publicIPAddress: extractDefined(instance, 'publicIpAddress'),
  sshKeyName: extractDefined(instance, 'sshKeyName'),
  sshUsername: 'ubuntu',
  providerId: extractDefined(instance, 'name'),
  version: requiredTag(instance.tags || [], TAGS.MACHINE_VERSION),
  envId: requiredTag(instance.tags || [], TAGS.ENV_ID),
})

type DriverContext = {
  log: Logger
  debug: boolean
  client: Client
  region: string
  store: Store
}

const listMachines = ({ client }: { client: Client }) => asyncMap(machineFromInstance, client.listInstances())

const machineDriver = ({
  client,
  region,
  store,
}: DriverContext): MachineDriver<SshMachine> => {
  const keyAlias = region

  return {
    friendlyName: 'AWS Lightsail',
    customizationScripts: CUSTOMIZE_BARE_MACHINE,

    getMachine: async ({ envId }) => {
      const instance = await client.findInstance(envId)
      return instance && machineFromInstance(instance)
    },

    listMachines: () => listMachines({ client }),

    resourcePlurals: {
      snapshot: 'snapshots',
      keypair: 'keypairs',
    },

    ...sshDriver({ getSshKey: () => getStoredSshKey(store, keyAlias) }),

    machineStatusCommand: async () => machineStatusNodeExporterCommand,
  }
}

const flags = {
  region: Flags.string({
    description: 'AWS region in which resources will be provisioned',
    required: true,
    env: 'AWS_REGION',
  }),
} as const

type FlagTypes = Omit<InferredFlags<typeof flags>, 'json'>

const contextFromFlags = ({ region }: FlagTypes): { region: string } => ({
  region: region as string,
})

const inquireFlags = async ({ log: _log }: { log: Logger }) => {
  const region = await inquirerAutoComplete<string>({
    default: process.env.AWS_REGION ?? 'us-east-1',
    message: flags.region.description as string,
    source: async input => REGIONS.filter(r => !input || r.includes(input.toLowerCase())).map(value => ({ value })),
    suggestOnly: true,
    transformer: i => i.toLowerCase(),
  })
  return { region }
}

const factory: MachineDriverFactory<FlagTypes, SshMachine> = ({
  flags: f,
  profile: { id: profileId },
  store,
  log,
  debug,
}) => {
  const c = contextFromFlags(f)
  return machineDriver({
    log,
    debug,
    client: createClient({ ...c, profileId }),
    store,
    ...c,
  })
}

const DEFAULT_BUNDLE_ID: BundleId = 'medium_2_0'

const machineCreationFlags = {
  ...flags,
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

type MachineCreationFlagTypes = InferredFlags<typeof machineCreationFlags>

type MachineCreationContext = DriverContext & {
  availabilityZone?: string
  bundleId?: BundleId
  metadata: MachineCreationFlagTypes
}

const machineCreationDriver = (
  { region, client, availabilityZone, bundleId: specifiedBundleId, store, log, debug, metadata }: MachineCreationContext
): MachineCreationDriver<SshMachine, ResourceType> => {
  const bundleId = specifiedBundleId ?? DEFAULT_BUNDLE_ID
  const keyAlias = region

  const ensureStoredKeyPairName = async () => {
    const existingProviderKeyPair = await client.findKeyPairByAlias(keyAlias)
    if (existingProviderKeyPair) {
      return existingProviderKeyPair.name
    }

    const newProviderKeyPair = await client.createKeyPair({ alias: keyAlias })
    await sshKeysStore(store).writeKey({
      alias: keyAlias,
      privateKey: newProviderKeyPair.privateKey,
      publicKey: newProviderKeyPair.publicKey,
    })

    return newProviderKeyPair.providerId
  }

  const ssh = sshDriver({ getSshKey: () => getStoredSshKey(store, keyAlias) })

  return ({
    metadata: { ...metadata, keyPairAlias: keyAlias, machineVersion: CURRENT_MACHINE_VERSION },
    getMachineAndSpecDiff: async ({ envId }) => {
      const instance = await client.findInstance(envId)
      return instance && {
        ...machineFromInstance(instance),
        specDiff: specifiedBundleId && specifiedBundleId !== instance.bundleId
          ? [{ name: 'bundle-id', old: instance.bundleId as string, new: specifiedBundleId }]
          : [],
      }
    },

    createMachine: async ({ envId }) => {
      const instanceSnapshot = await client.findInstanceSnapshot({ version: CURRENT_MACHINE_VERSION, bundleId })
      const haveSnapshot = instanceSnapshot?.state === 'available'
      const startTime = new Date().getTime()
      telemetryEmitter().capture('aws lightsail create machine start', { region, bundle_id: bundleId, have_snapshot: haveSnapshot })
      return {
        fromSnapshot: haveSnapshot,
        result: (async () => {
          const instance = await client.createInstance({
            bundleId: bundleId ?? DEFAULT_BUNDLE_ID,
            instanceSnapshotName: haveSnapshot ? instanceSnapshot?.name : undefined,
            availabilityZone,
            name: `preevy-${envId}-${randomBytes(16).toString('hex')}`,
            envId,
            versionTag: CURRENT_MACHINE_VERSION,
            keyPairName: await ensureStoredKeyPairName(),
          })

          telemetryEmitter().capture('aws lightsail create machine end', { region, bundle_id: bundleId, have_snapshot: haveSnapshot, elapsed_sec: (new Date().getTime() - startTime) / 1000 })
          const machine = machineFromInstance(instance)
          return {
            machine,
            connection: await ssh.connect(
              machine,
              { log, debug, retryOpts: { minTimeout: 2000, maxTimeout: 5000, retries: 10 } },
            ),
          }
        })(),
      }
    },

    ensureMachineSnapshot: async ({ providerId, envId, wait }) => {
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

    listDeletableResources: () => {
      const machines = listMachines({ client })

      const snapshots = asyncMap(
        ({ name }) => ({ type: 'snapshot' as ResourceType, providerId: name as string }),
        client.listInstanceSnapshots(),
      )
      const keyPairs = asyncMap(
        ({ name }) => ({ type: 'keypair' as ResourceType, providerId: name as string }),
        client.listKeyPairsByAlias(keyAlias),
      )

      return asyncConcat(machines, snapshots, keyPairs)
    },

    deleteResources: async (wait, ...resources) => {
      await Promise.all(resources.map(({ type, providerId }) => {
        if (type === 'snapshot') {
          return client.deleteInstanceSnapshot({ instanceSnapshotName: providerId, wait })
        }
        if (type === 'keypair') {
          return Promise.all([
            client.deleteKeyPair(providerId, wait),
            sshKeysStore(store).deleteKey(keyAlias),
          ])
        }
        if (type === 'machine') {
          return client.deleteInstance(providerId, wait)
        }
        throw new Error(`Unknown resource type "${type}"`)
      }))
    },
  })
}

const machineCreationContextFromFlags = (
  fl: MachineCreationFlagTypes,
): ReturnType<typeof contextFromFlags> & { availabilityZone: string; bundleId: BundleId } => ({
  ...contextFromFlags(fl),
  availabilityZone: fl['availability-zone'] as string,
  bundleId: fl['bundle-id'] as BundleId,
})

const machineCreationFactory: MachineCreationDriverFactory<MachineCreationFlagTypes, SshMachine> = ({
  flags: f,
  profile: { id: profileId },
  store,
  log,
  debug,
}) => {
  const c = machineCreationContextFromFlags(f)
  return machineCreationDriver({
    metadata: pick(f, Object.keys(machineCreationFlags)) as MachineCreationFlagTypes, // filter out non-driver flags
    ...c,
    client: createClient({ ...c, profileId }),
    store,
    log,
    debug,
  })
}

export default {
  flags,
  factory,
  machineCreationFlags,
  machineCreationFactory,
  inquireFlags,
} as const
