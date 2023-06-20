import fs from 'fs'
import { Flags, Interfaces } from '@oclif/core'
import {
  MachineDriver,
  MachineDriverFactory,
  orderedOutput,
  commandWith,
  execResultFromOrderedOutput,
  checkResult,
  expandStdioOptions,
} from '@preevy/core'
import { asyncMap } from 'iter-tools-es'
import { AddressInfo } from 'net'
import { Readable, Writable } from 'stream'
import { DeploymentMachine, ResourceType, machineFromDeployment } from './common'
import createClient, { loadKubeConfig } from './client'
import { PACKAGE_JSON, DEFAULT_TEMPLATE } from '../static'

export type DriverContext = {
  profileId: string
  namespace: string
  kubeconfig?: string
  template?: string
}

const isTTY = (s: Readable | Writable) => (s as unknown as { isTTY: boolean }).isTTY

const machineDriver = (
  { profileId, template: templateFile = DEFAULT_TEMPLATE, kubeconfig, namespace }: DriverContext,
): MachineDriver<DeploymentMachine, ResourceType> => {
  const client = createClient({
    namespace,
    kc: loadKubeConfig(kubeconfig),
    profileId,
    package: fs.promises.readFile(PACKAGE_JSON, 'utf-8').then(JSON.parse),
    template: fs.promises.readFile(templateFile, 'utf-8'),
  })

  return ({
    friendlyName: 'Kubernetes Docker-in-Docker',

    getMachine: async ({ envId }) => {
      const deployment = await client.findMostRecentDeployment(envId)
      return deployment && machineFromDeployment(deployment)
    },

    listDeletableResources: () => asyncMap(machineFromDeployment, client.listProfileDeployments()),

    deleteResources: async (wait, ...resources) => {
      await Promise.all(resources.map(({ type, providerId }) => {
        if (type === 'machine') {
          return client.deleteEnv(providerId, { wait })
        }
        throw new Error(`Unknown resource type: "${type}"`)
      }))
    },

    resourcePlurals: {},

    spawnRemoteCommand: async (machine, command, stdio) => {
      const { stdin, stdout, stderr } = expandStdioOptions(stdio)
      return await client.exec({
        deployment: (machine as DeploymentMachine).deployment,
        command: command.length > 0 ? command : ['sh'],
        tty: [stdin, stdout, stderr].every(isTTY),
        stdin,
        stdout,
        stderr,
      })
    },

    connect: async machine => {
      const { deployment } = machine as DeploymentMachine

      return ({
        close: async () => undefined,

        exec: async (command, opts) => {
          const { code, output } = await client.exec({
            deployment,
            command: ['sh', '-c', commandWith(command, opts ?? {})],
            stdin: opts?.stdin,
          })
          const result = {
            code,
            ...execResultFromOrderedOutput(orderedOutput(output)),
          }
          return opts?.ignoreExitCode ? result : checkResult(command, result)
        },

        dockerSocket: async () => {
          const host = '0.0.0.0'
          const { localSocket, close } = await client.portForward(deployment, 2375, { host, port: 0 })
          return {
            address: { host, port: (localSocket as AddressInfo).port },
            close,
          }
        },
      })
    },
  })
}

export const flags = {
  namespace: Flags.string({
    description: 'Kubernetes namespace in which resources will be provisioned',
    required: false,
    default: 'default',
  }),
  kubeconfig: Flags.file({
    description: 'Path to kubeconfig file',
    exists: true,
    required: false,
  }),
  template: Flags.file({
    description: 'Path to resources template file',
    exists: true,
    required: false,
  }),
} as const

type FlagTypes = Omit<Interfaces.InferredFlags<typeof flags>, 'json'>

export const contextFromFlags = ({ namespace, kubeconfig, template }: FlagTypes): Omit<DriverContext, 'profileId' | 'store'> => ({
  namespace,
  kubeconfig,
  template,
})

export const factory: MachineDriverFactory<
  Interfaces.InferredFlags<typeof flags>,
  DeploymentMachine,
  ResourceType
> = (f, profile) => machineDriver({ ...contextFromFlags(f), profileId: profile.id })
