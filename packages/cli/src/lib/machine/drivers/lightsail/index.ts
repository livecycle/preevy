import {
  Instance, InstanceSnapshotState,
} from '@aws-sdk/client-lightsail'
import { asyncMap } from 'iter-tools-es'

import { Command, Flags, Interfaces } from '@oclif/core'
import { randomBytes } from 'crypto'
import { extractDefined } from '../../../aws-utils/nulls'
import { Machine, MachineDriver } from '../../driver'
import { removeDriverPrefix } from '../../driver/flags'
import createClient from './client'
import { CURRENT_MACHINE_VERSION, INSTANCE_TAGS, requiredTag } from './tags'
import { CustomizedMachine } from '../../driver/driver'

const bareMachineFromInstance = (instance: Instance): Omit<Machine, 'version'> => ({
  privateIPAddress: extractDefined(instance, 'privateIpAddress'),
  publicIPAddress: extractDefined(instance, 'publicIpAddress'),
  sshKeyName: extractDefined(instance, 'sshKeyName'),
  sshUsername: extractDefined(instance, 'username'),
  providerId: extractDefined(instance, 'name'),
})

const machineFromTaggedInstance = (
  instance: Instance,
): CustomizedMachine & { envId: string } => ({
  ...bareMachineFromInstance(instance),
  version: requiredTag(instance.tags, INSTANCE_TAGS.MACHINE_VERSION),
  envId: requiredTag(instance.tags, INSTANCE_TAGS.ENV_ID),
})

export type DriverContext = {
  region: string
  availabilityZone?: string
}

const machineDriver = ({
  region,
  availabilityZone,
}: DriverContext): MachineDriver => {
  const client = createClient({ region })

  return {
    getMachine: async ({ envId }) => {
      const instance = await client.findInstance(envId)
      return instance && machineFromTaggedInstance(instance)
    },

    listMachines: () => asyncMap(
      machineFromTaggedInstance,
      client.listInstances(),
    ),

    createKeyPair: async ({ envId }) => client.createKeyPair({
      envId,
      name: `preview-${envId}-${randomBytes(16).toString('hex')}`,
    }),

    createMachine: async ({ envId, keyPairName }) => {
      const instanceSnapshot = await client.findInstanceSnapshot({
        version: CURRENT_MACHINE_VERSION,
        requestedState: InstanceSnapshotState.Available,
      })

      const instance = await client.createInstance({
        instanceSnapshotName: instanceSnapshot?.name,
        availabilityZone,
        name: `preview-${envId}-${randomBytes(16).toString('hex')}`,
        keyPairName,
      })

      return { ...bareMachineFromInstance(instance), fromSnapshot: instanceSnapshot !== undefined }
    },

    onMachineCreated: async ({ providerId, envId, fromSnapshot }) => {
      await client.tagResource({ name: providerId, envId, versionTag: CURRENT_MACHINE_VERSION })

      if (fromSnapshot) {
        return
      }

      const instanceSnapshot = await client.findInstanceSnapshot({ version: CURRENT_MACHINE_VERSION })
      if (instanceSnapshot) {
        return
      }
      await client.createInstanceSnapshot({
        instanceSnapshotName: `preview-${CURRENT_MACHINE_VERSION}-${randomBytes(16).toString('hex')}`,
        envId,
        instanceName: providerId,
        version: CURRENT_MACHINE_VERSION,
        wait: false,
      })
    },

    removeMachine: providerId => client.deleteInstance(providerId),

    listKeyPairs: () => asyncMap(keyPair => extractDefined(keyPair, 'name'), client.listKeyPairs()),
  }
}

machineDriver.flags = {
  region: Flags.string({
    description: 'AWS region to provision resources in',
    required: true,
    env: 'AWS_REGION',
  }),
  'availability-zone': Flags.string({
    description: 'AWS availability zone to provision resources in region',
    required: false,
    env: 'AWS_AVAILABILITY_ZONE',
  }),
} as const

machineDriver.fromFlags = <Command extends typeof Command>(driverName: string, flags: Interfaces.InferredFlags<Command['flags']>) => {
  const f = removeDriverPrefix<Interfaces.InferredFlags<typeof machineDriver.flags>>(driverName, flags)
  return machineDriver({ region: f.region as string, availabilityZone: f['availability-zone'] })
}

export default machineDriver
