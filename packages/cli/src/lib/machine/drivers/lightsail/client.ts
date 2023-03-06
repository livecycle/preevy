import {
  GetKeyPairsCommandOutput,
  Instance,
  InstanceSnapshot,
  KeyPair,
  Lightsail, LightsailClient,
} from '@aws-sdk/client-lightsail'
import { asyncFilter, asyncFind } from 'iter-tools-es'

import { ensureDefined, extractDefined } from '../../../aws-utils/nulls'
import { paginationIterator } from '../../../aws-utils/pagination'
import { waitUntilAllOperationsSucceed, waitUntilOperationSucceeds } from './operation-waiter'
import { allTagsPredicate, INSTANCE_TAGS, KEYPAIR_TAGS } from './tags'

const getFirstAvailabilityZoneForRegion = async (ls: Lightsail) => {
  const regions = await extractDefined(ls.getRegions({ includeAvailabilityZones: true }), 'regions')
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

const client = ({ region }: { region: string }) => {
  const lsClient = new LightsailClient({ region })
  const ls = new Lightsail({ region })

  return {
    findInstance: async (
      envId: string,
      versionTag?: string,
    ) => {
      const tagsToFind = [
        { key: INSTANCE_TAGS.ENV_ID, value: envId },
      ]
      if (versionTag) {
        tagsToFind.push({ key: INSTANCE_TAGS.MACHINE_VERSION, value: versionTag })
      }

      const tagsPredicate = allTagsPredicate(...tagsToFind)
      return asyncFind(
        ({ tags }: Instance) => tagsPredicate(tags ?? []),
        paginationIterator(pageToken => ls.getInstances({ pageToken }), 'instances'),
      )
    },

    listInstances: () => asyncFilter(
      ({ tags }: Instance) => (tags || []).some(tag => tag.key === INSTANCE_TAGS.ENV_ID),
      paginationIterator(pageToken => ls.getInstances({ pageToken }), 'instances'),
    ),

    ensureInstanceIsRunning: async (instance: Instance) => {
      if (instance.state?.name !== 'running') {
        await waitUntilAllOperationsSucceed(
          { client: lsClient, maxWaitTime: 120 },
          ls.startInstance({ instanceName: instance.name }),
        )
      }
      return extractDefined(ls.getInstance({ instanceName: instance.name }), 'instance')
    },

    createKeyPair: async ({ name, envId }: { name: string; envId: string }) => {
      const { publicKeyBase64, privateKeyBase64, keyPair } = await ensureDefined(ls.createKeyPair({
        keyPairName: name,
        tags: [
          { key: KEYPAIR_TAGS.ENV_ID, value: envId },
        ],
      }), 'publicKeyBase64', 'privateKeyBase64', 'keyPair')

      return {
        publicKey: publicKeyBase64,
        privateKey: privateKeyBase64,
        name: extractDefined(keyPair, 'name'),
      }
    },

    findKeyPair: async ({ envId }: { envId: string }) => {
      const tagsPredicate = allTagsPredicate(
        { key: KEYPAIR_TAGS.ENV_ID, value: envId },
      )
      return asyncFind(
        (x: Instance) => x.name === envId && tagsPredicate(x.tags ?? []),
        paginationIterator(pageToken => ls.getKeyPairs({ pageToken }), 'keyPairs'),
      )
    },

    listKeyPairs: () => paginationIterator<KeyPair, 'keyPairs', GetKeyPairsCommandOutput>(
      pageToken => ls.getKeyPairs({ pageToken }),
      'keyPairs',
    ),

    createInstance: async ({ name, envId, versionTag, availabilityZone, keyPairName, instanceSnapshotName }: {
      envId: string
      versionTag: string
      availabilityZone?: string
      instanceSnapshotName?: string
      keyPairName: string
      name: string
    }) => {
      const commonArgs = {
        bundleId: 'small_2_0',
        availabilityZone: availabilityZone ?? await getFirstAvailabilityZoneForRegion(ls),
        instanceNames: [name],
        keyPairName,
        tags: [
          { key: INSTANCE_TAGS.ENV_ID, value: envId },
          { key: INSTANCE_TAGS.MACHINE_VERSION, value: versionTag },
        ],
      }

      const res = instanceSnapshotName
        ? ls.createInstancesFromSnapshot({ ...commonArgs, instanceSnapshotName })
        : ls.createInstances({ ...commonArgs, blueprintId: 'ubuntu_20_04' })

      await waitUntilAllOperationsSucceed(
        { client: lsClient, maxWaitTime: 120 },
        res,
      )

      await ls.putInstancePublicPorts({
        instanceName: name,
        portInfos: [{
          fromPort: 22, toPort: 22, protocol: 'TCP', cidrs: ['0.0.0.0/0'], ipv6Cidrs: ['::/0'],
        }],
      })

      return extractDefined(ls.getInstance({ instanceName: name }), 'instance')
    },

    closeAllPortsExceptSsh: async ({ instanceName }: {
      instanceName: string
    }) => waitUntilAllOperationsSucceed(
      { client: lsClient, maxWaitTime: 120 },
      ls.putInstancePublicPorts({
        instanceName,
        portInfos: [{
          fromPort: 22, toPort: 22, protocol: 'TCP', cidrs: ['0.0.0.0/0'], ipv6Cidrs: ['::/0'],
        }],
      })
    ),

    findInstanceSnapshot: async ({ version }: { version: string }) => {
      const tagsPredicate = allTagsPredicate(
        { key: INSTANCE_TAGS.MACHINE_VERSION, value: version },
      )
      return asyncFind(
        ({ tags }: InstanceSnapshot) => tagsPredicate(tags ?? []),
        paginationIterator(pageToken => ls.getInstanceSnapshots({ pageToken }), 'instanceSnapshots'),
      )
    },

    createInstanceSnapshot: async (
      { envId, instanceName, instanceSnapshotName, version }: {
        instanceName: string
        envId: string
        instanceSnapshotName: string
        version: string
      },
    ) => waitUntilAllOperationsSucceed(
      { client: lsClient, maxWaitTime: 120 },
      ls.createInstanceSnapshot({
        instanceSnapshotName,
        instanceName,
        tags: [
          { key: INSTANCE_TAGS.ENV_ID, value: envId },
          { key: INSTANCE_TAGS.MACHINE_VERSION, value: version },
        ],
      }),
    ),

    deleteInstanceSnapshot: async (
      { instanceSnapshotName }: { instanceSnapshotName: string },
    ) => waitUntilAllOperationsSucceed(
      { client: lsClient, maxWaitTime: 120 },
      ls.deleteInstanceSnapshot({ instanceSnapshotName }),
    ),

    deleteInstance: async (name: string) => waitUntilAllOperationsSucceed(
      { client: lsClient, maxWaitTime: 120 },
      ls.deleteInstance({ instanceName: name, forceDeleteAddOns: true }),
    ),

    deleteKeyPair: async (name: string) => waitUntilOperationSucceeds(
      { client: lsClient, maxWaitTime: 120 },
      await ls.deleteKeyPair({ keyPairName: name }),
    ),
  }
}

export default client
