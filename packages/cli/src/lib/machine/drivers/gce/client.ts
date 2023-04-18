import { InstancesClient, ImagesClient, ZoneOperationsClient } from '@google-cloud/compute'
import { GoogleError, Status, operationsProtos } from 'google-gax'
import { asyncFirst } from 'iter-tools-es'
import { LABELS } from './labels'

async function extractFirst<T>(p: Promise<[T, ...unknown[]]>): Promise<T>
async function extractFirst<T>(p: Promise<T[]>): Promise<T>
async function extractFirst<T>(p: Promise<T[]> | Promise<[T, ...unknown[]]>) { return (await p)[0] }

type Operation = operationsProtos.google.longrunning.IOperation

const isNotFoundError = (e: Error) => e instanceof GoogleError && e.code === Status.NOT_FOUND
const undefinedForNotFound = <T>(p: Promise<T>): Promise<T | [undefined]> => p.catch(e => {
  if (isNotFoundError(e)) {
    return [undefined]
  }
  throw e
})

const client = ({
  zone,
  project,
  profileId,
}: {
  zone: string
  project: string
  profileId: string
}) => {
  const ic = new InstancesClient()
  const imc = new ImagesClient()
  const zoc = new ZoneOperationsClient()

  const waitForOperation = async (op: Operation) => {
    let { done } = op
    while (!done) {
      // eslint-disable-next-line no-await-in-loop
      const { status } = await extractFirst(zoc.wait({ zone, project, operation: op.name }))
      done = status === 'DONE'
    }
  }

  const labelFilter = (key: string, value: string) => `labels.${key} = "${value}"`
  const baseFilter = labelFilter(LABELS.PROFILE_ID, profileId)
  const envIdFilter = (envId: string) => labelFilter(LABELS.ENV_ID, envId)
  const filter = (envId?: string) => [baseFilter, ...(envId ? [envIdFilter(envId)] : [])]
    .map(s => `(${s})`)
    .join(' ')

  const instanceName = (envId: string) => `preevy-${profileId}-${envId}`

  const normalizeMachineType = (machineType: string) => (
    machineType.includes('/')
      ? machineType
      : `https://www.googleapis.com/compute/v1/projects/${project}/zones/${zone}/machineTypes/${machineType}`
  )

  return {
    getInstance: async (instance: string) => extractFirst(undefinedForNotFound(ic.get({ instance, zone, project }))),

    findInstance: async (
      envId: string,
    ) => extractFirst(undefinedForNotFound(ic.get({ zone, project, instance: instanceName(envId) }))),

    listInstances: () => ic.listAsync({ zone, project, filter: filter() }),

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
      }))

      if (!image) {
        throw new Error('Could not find a suitable image in GCP')
      }

      const machineType = normalizeMachineType(givenMachineType)
      const name = instanceName(envId)

      const { latestResponse: operation } = await extractFirst(ic.insert({
        project,
        zone,
        instanceResource: {
          name,
          labels: {
            [LABELS.ENV_ID]: envId,
            [LABELS.PROFILE_ID]: profileId,
          },
          machineType,
          disks: [{
            diskSizeGb: 10,
            type: 'pd-standard',
            boot: true,
            autoDelete: true,
            initializeParams: {
              sourceImage: image.selfLink,
              diskSizeGb: 10,
            },
          }],
          metadata: {
            items: [{ key: 'ssh-keys', value: `${username}:${sshPublicKey}` }],
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
      }))

      await waitForOperation(operation)

      return extractFirst(ic.get({ zone, project, instance: name }))
    },

    deleteInstance: async (name: string) => {
      const { latestResponse: operation } = await extractFirst(ic.delete({ zone, project, instance: name }))
      await waitForOperation(operation as unknown as Operation)
    },

    normalizeMachineType,
  }
}

export type Client = ReturnType<typeof client>
export type Instance = NonNullable<Awaited<ReturnType<Client['findInstance']>>>

export const shortResourceName = (name: string) => name.split('/').pop() as string

export default client
