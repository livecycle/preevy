import {
  Instance,
  InstanceSnapshot,
  KeyPair,
  Lightsail,
  LightsailClient,
} from '@aws-sdk/client-lightsail'
import { randomBytes } from 'crypto'
import { asyncFilter, asyncFind, asyncFirst } from 'iter-tools-es'

import { ensureDefined, extractDefined } from '@preevy/core'
import { paginationIterator } from '../aws-utils/pagination.js'
import { waitUntilAllOperationsSucceed } from './operation-waiter.js'
import { BundleId, bundleIdEqualOrLarger, bundleIdFromString } from './bundle-id.js'
import { instanceTags, instanceTagsPredicate, keypairTags, keypairTagsPredicate, snapshotTags, snapshotTagsPredicate } from './tags.js'

export const REGIONS = [
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
] as const

const getFirstAvailabilityZoneForRegion = async (ls: Lightsail) => {
  const regions = await extractDefined(
    ls.getRegions({ includeAvailabilityZones: true }),
    'regions'
  )
  const region = await ls.config.region()
  const foundRegion = regions.find(r => r.name === region)
  if (!foundRegion) {
    throw new Error(`Could not find region "${region}"`)
  }
  if (!foundRegion.availabilityZones?.length) {
    throw new Error(`Could not find availability zones for region "${region}"`)
  }
  return foundRegion.availabilityZones[0].zoneName
}

const client = ({
  region,
  profileId,
}: {
  region: string
  profileId: string
}) => {
  const lsClient = new LightsailClient({ region })
  const ls = new Lightsail({ region })

  const potentiallyWait = (
    wait: boolean,
    ...args: Parameters<typeof waitUntilAllOperationsSucceed>
  ): Promise<void> => {
    if (wait) {
      return waitUntilAllOperationsSucceed(...args)
    }
    return Promise.resolve()
  }

  const listKeyPairsByAlias = (alias: string) => {
    const tagsPredicate = keypairTagsPredicate({ alias, profileId })
    return asyncFilter(
      (x: KeyPair) => tagsPredicate(x.tags ?? []),
      paginationIterator(pageToken => ls.getKeyPairs({ pageToken }), 'keyPairs'),
    )
  }

  const findKeyPairByAlias = async (alias: string) => {
    const result = await asyncFirst(listKeyPairsByAlias(alias))
    if (!result) {
      return undefined
    }
    return ensureDefined(result, 'name')
  }

  return {
    getInstance: async (instanceName: string) => (await ls.getInstance({ instanceName })).instance,

    findInstance: async (
      envId: string,
      version?: string
    ) => {
      const tagsPredicate = instanceTagsPredicate({ envId, profileId, version })
      return await asyncFind(
        ({ tags }: Instance) => tagsPredicate(tags ?? []),
        paginationIterator(
          pageToken => ls.getInstances({ pageToken }),
          'instances'
        )
      )
    },

    listInstances: () => {
      const tagsPredicate = instanceTagsPredicate({ profileId })
      return asyncFilter(
        ({ tags }: Instance) => tagsPredicate(tags || []),
        paginationIterator(
          pageToken => ls.getInstances({ pageToken }),
          'instances'
        )
      )
    },

    listInstanceSnapshots: () => {
      const tagsPredicate = snapshotTagsPredicate({ profileId })
      return asyncFilter(
        ({ tags }: InstanceSnapshot) => tagsPredicate(tags || []),
        paginationIterator(
          pageToken => ls.getInstanceSnapshots({ pageToken }),
          'instanceSnapshots'
        )
      )
    },

    ensureInstanceIsRunning: async (instance: Instance) => {
      if (instance.state?.name !== 'running') {
        await waitUntilAllOperationsSucceed(
          { client: lsClient, maxWaitTime: 120 },
          ls.startInstance({ instanceName: instance.name })
        )
      }
      // eslint false positive here on case-sensitive filesystems due to unknown type

      return await extractDefined(
        ls.getInstance({ instanceName: instance.name }),
        'instance'
      )
    },

    createKeyPair: async ({ alias }: { alias: string }) => {
      const internalName = `preevy-${profileId}-${alias}-${randomBytes(16).toString('hex')}`
      const { publicKeyBase64, privateKeyBase64, keyPair } = await ensureDefined(
        ls.createKeyPair({
          keyPairName: internalName,
          tags: keypairTags({ alias, profileId }),
        }),
        'publicKeyBase64',
        'privateKeyBase64',
        'keyPair',
      )

      return {
        publicKey: publicKeyBase64,
        privateKey: privateKeyBase64,
        providerId: extractDefined(keyPair, 'name'),
      }
    },

    findKeyPairByAlias,
    listKeyPairsByAlias,

    createInstance: async ({
      name,
      envId,
      versionTag: version,
      availabilityZone,
      keyPairName,
      instanceSnapshotName,
      bundleId,
    }: {
      envId: string
      versionTag: string
      availabilityZone?: string
      instanceSnapshotName?: string
      keyPairName: string
      name: string
      bundleId: string
    }) => {
      const commonArgs = {
        bundleId,
        availabilityZone: availabilityZone ?? (await getFirstAvailabilityZoneForRegion(ls)),
        instanceNames: [name],
        keyPairName,
        tags: instanceTags({ profileId, envId, version }),
      }

      const res = instanceSnapshotName
        ? ls.createInstancesFromSnapshot({
          ...commonArgs,
          instanceSnapshotName,
        })
        : ls.createInstances({ ...commonArgs, blueprintId: 'ubuntu_24_04' })

      await waitUntilAllOperationsSucceed(
        { client: lsClient, maxWaitTime: 150 },
        res
      )

      await ls.putInstancePublicPorts({
        instanceName: name,
        portInfos: [
          {
            fromPort: 22,
            toPort: 22,
            protocol: 'tcp',
            cidrs: ['0.0.0.0/0'],
            ipv6Cidrs: ['::/0'],
          },
        ],
      })

      // eslint false positive here on case-sensitive filesystems due to unknown type

      return await extractDefined(ls.getInstance({ instanceName: name }), 'instance')
    },

    findInstanceSnapshot: async ({
      version,
      bundleId,
    }: {
      version: string
      bundleId: BundleId
    }) => {
      const tagsPredicate = snapshotTagsPredicate({ profileId, version })

      return await asyncFind(
        ({ tags, fromBundleId: b }: InstanceSnapshot) => {
          const fromBundleId = bundleIdFromString(b as string, { throwOnError: false })
          return fromBundleId !== undefined
            && bundleIdEqualOrLarger(bundleId, fromBundleId)
            && tagsPredicate(tags ?? [])
        },
        paginationIterator(
          pageToken => ls.getInstanceSnapshots({ pageToken }),
          'instanceSnapshots'
        )
      )
    },

    createInstanceSnapshot: async ({
      instanceName,
      instanceSnapshotName,
      version,
      wait,
    }: {
      instanceName: string
      envId: string
      instanceSnapshotName: string
      version: string
      wait: boolean
    }) => await potentiallyWait(
      wait,
      { client: lsClient, maxWaitTime: 120 },
      await ls.createInstanceSnapshot({
        instanceSnapshotName,
        instanceName,
        tags: snapshotTags({ profileId, version }),
      }),
    ),

    deleteInstanceSnapshot: async ({
      instanceSnapshotName,
      wait,
    }: {
      instanceSnapshotName: string
      wait: boolean
    }) => await potentiallyWait(
      wait,
      { client: lsClient, maxWaitTime: 120 },
      await ls.deleteInstanceSnapshot({ instanceSnapshotName }),
    ),

    deleteInstance: async (name: string, wait: boolean) => await potentiallyWait(
      wait,
      { client: lsClient, maxWaitTime: 120 },
      await ls.deleteInstance({ instanceName: name, forceDeleteAddOns: true }),
    ),

    deleteKeyPair: async (alias: string, wait: boolean) => {
      const keyPair = await findKeyPairByAlias(alias)
      if (!keyPair) {
        return
      }

      await potentiallyWait(
        wait,
        { client: lsClient, maxWaitTime: 120 },
        await ls.deleteKeyPair({ keyPairName: keyPair.name }),
      )
    },
  }
}

export type Client = ReturnType<typeof client>

export default client
