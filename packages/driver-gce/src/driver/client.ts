import { InstancesClient, ImagesClient, ZoneOperationsClient, RegionsClient } from '@google-cloud/compute'
import { GoogleError, Status, operationsProtos, CallOptions } from 'google-gax'
import { asyncFirst, asyncToArray } from 'iter-tools-es'
import { randomBytes } from 'crypto'
import { LABELS, isValidLabel, normalizeLabel } from './labels.js'
import { readCloudConfig } from '../static.js'
import { metadataKey, serializeMetadata } from './metadata.js'

type Operation = operationsProtos.google.longrunning.IOperation

const isNotFoundError = (e: Error) => e instanceof GoogleError && e.code === Status.NOT_FOUND
const ignoreNotFound = (e: Error) => {
  if (isNotFoundError(e)) {
    return undefined
  }
  throw e
}

const callOpts: CallOptions = { retry: { retryCodes: ['ECONNRESET'] as unknown as number[] } }
const MAX_INSTANCE_NAME_LENGTH = 62


export const instanceError = (instance: Instance) => {
  if (instance.status === 'RUNNING') {
    return undefined
  }
  return { error: `Instance is in status ${instance.status}` }
}

const client = ({
  zone,
  projectId,
  profileId,
}: {
  zone: string
  projectId: string
  profileId: string
}) => {
  const ic = new InstancesClient()
  const imc = new ImagesClient()
  const zoc = new ZoneOperationsClient()

  const waitForOperation = async (op: Operation) => {
    let { done } = op
    while (!done) {

      const [{ status }] = await zoc.wait({ zone, project: projectId, operation: op.name }, callOpts)
      done = status === 'DONE'
    }
  }

  const orFilter = (...conditions: string[]) => `${conditions.map(cond => `(${cond})`).join(' OR ')}`
  const labelFilter = (key: string, value: string) => `labels.${key} = "${value}"`
  const profileFilter = orFilter(...[
    labelFilter(LABELS.PROFILE_ID, normalizeLabel(profileId)),
    ...isValidLabel(profileId) ? [labelFilter(LABELS.OLD_PROFILE_ID, profileId)] : [], // backwards compat
  ])
  const envIdFilter = (envId: string) => orFilter(...[
    labelFilter(LABELS.ENV_ID, normalizeLabel(envId)),
    ...isValidLabel(envId) ? [labelFilter(LABELS.OLD_ENV_ID, envId)] : [], // backwards compat
  ])
  const filter = (envId?: string) => [profileFilter, ...(envId ? [envIdFilter(envId)] : [])]
    .map(s => `(${s})`)
    .join(' AND ')

  const instanceName = (envId: string) => {
    const prefix = 'preevy-'
    const suffix = `-${randomBytes(8).toString('base64url').toLowerCase().replace(/[^a-z0-9]/g, '')}`
    const middle = `${profileId}-${envId}`
    const middleMaxLength = MAX_INSTANCE_NAME_LENGTH - (prefix.length + suffix.length)
    return [prefix, middle.substring(0, middleMaxLength), suffix].join('')
  }

  const normalizeMachineType = (machineType: string) => (
    machineType.includes('/')
      ? machineType
      : `https://www.googleapis.com/compute/v1/projects/${projectId}/zones/${zone}/machineTypes/${machineType}`
  )

  const getInstance = async (
    instance: string,
  ) => (await ic.get({ instance, zone, project: projectId }, callOpts))?.[0]

  const findEnvInstances = (
    envId: string,
  ) => ic.listAsync({ zone, project: projectId, filter: filter(envId) }, callOpts)

  return {
    getInstance: async (instance: string) => await getInstance(instance).catch(ignoreNotFound),

    findEnvInstances,
    findBestEnvInstance: async (
      envId: string
    ) => {
      const instances = await asyncToArray(findEnvInstances(envId))
      return instances.find(i => !instanceError(i)) ?? instances[0]
    },

    listInstances: () => ic.listAsync({ zone, project: projectId, filter: filter() }, callOpts),

    createInstance: async ({
      envId,
      sshPublicKey,
      username,
      machineType: givenMachineType,
    }: {
      envId: string
      sshPublicKey: string
      username: string
      machineType: string
    }) => {
      const image = await asyncFirst(imc.listAsync({
        project: 'cos-cloud',
        maxResults: 1,
        filter: '(family = "cos-stable") (architecture = "X86_64") (NOT deprecated:*) (status = "READY")',
      }, callOpts))

      if (!image) {
        throw new Error('Could not find a suitable image in GCP')
      }

      const machineType = normalizeMachineType(givenMachineType)
      const name = instanceName(envId)

      const [{ latestResponse: operation }] = await ic.insert({
        project: projectId,
        zone,
        instanceResource: {
          name,
          labels: {
            [LABELS.ENV_ID]: normalizeLabel(envId),
            [LABELS.PROFILE_ID]: normalizeLabel(profileId),
          },
          machineType,
          disks: [{
            diskSizeGb: 60,
            type: 'pd-standard',
            boot: true,
            autoDelete: true,
            initializeParams: {
              sourceImage: image.selfLink,
              diskSizeGb: 60,
            },
          }],
          metadata: {
            items: [
              { key: 'ssh-keys', value: `${username}:${sshPublicKey}` },
              { key: 'user-data', value: await readCloudConfig() },
              { key: metadataKey, value: serializeMetadata({ envId, profileId }) },
            ],
          },
          networkInterfaces: [
            {
              name: 'global/networks/default',
              accessConfigs: [
                {
                  type: 'ONE_TO_ONE_NAT',
                  name: 'External NAT',
                },
              ],
            },
          ],
        },
      }, callOpts)

      await waitForOperation(operation)

      return await getInstance(name)
    },

    deleteInstance: async (name: string, wait: boolean) => {
      const [{ latestResponse: operation }] = await ic.delete({ zone, project: projectId, instance: name }, callOpts)
      if (wait) {
        await waitForOperation(operation)
      }
    },

    normalizeMachineType,
  }
}

export type Client = ReturnType<typeof client>
export type Instance = NonNullable<Awaited<ReturnType<Client['getInstance']>>>

export default client

export const shortResourceName = (name: string) => name.split('/').pop() as string

export const defaultProjectId = () => (new InstancesClient()).getProjectId()

export const availableRegions = async (project: string) => {
  const rc = new RegionsClient()
  const [z] = await rc.list({ project }, callOpts)
  return z.map(({ name, zones }) => ({ name: name as string, zones: (zones as string[]).map(shortResourceName) }))
}
