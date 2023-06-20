import fs from 'fs'
import { Flags, Interfaces } from '@oclif/core'
import { MachineCreationDriver, MachineCreationDriverFactory, telemetryEmitter } from '@preevy/core'
import { DeploymentMachine, machineFromDeployment } from './common'
import createClient, { loadKubeConfig } from './client'
import { PACKAGE_JSON, DEFAULT_TEMPLATE } from '../static'
import { DriverContext, contextFromFlags, flags as machineDriverFlags } from './machine-driver'

type MachineCreationDriverContext = DriverContext & { serverSideApply: boolean }

export const flags = {
  ...machineDriverFlags,
  'server-side-apply': Flags.boolean({
    description: 'Use server side apply to create Kubernetes resources',
    default: false,
    required: false,
  }),
} as const

export type MachineCreationFlagTypes = Omit<Interfaces.InferredFlags<typeof flags>, 'json'>

const machineCreationContextFromFlags = (
  fl: Interfaces.InferredFlags<typeof flags>
): Omit<MachineCreationDriverContext, 'profileId' | 'store'> => ({
  ...contextFromFlags(fl),
  serverSideApply: fl['server-side-apply'],
})

const machineCreationDriver = (
  {
    profileId,
    template: templateFile = DEFAULT_TEMPLATE,
    kubeconfig,
    namespace,
    serverSideApply,
  }: MachineCreationDriverContext,
): MachineCreationDriver<DeploymentMachine> => {
  const client = createClient({
    namespace,
    kc: loadKubeConfig(kubeconfig),
    profileId,
    package: fs.promises.readFile(PACKAGE_JSON, 'utf-8').then(JSON.parse),
    template: fs.promises.readFile(templateFile, 'utf-8'),
  })

  return {
    createMachine: async ({ envId }) => {
      const startTime = new Date().getTime()
      telemetryEmitter().capture('kube-docker create machine start', {})

      return ({
        fromSnapshot: true,
        machine: (
          async () => {
            const deployment = await client.createEnv(envId, { serverSideApply })
            telemetryEmitter().capture('kube-docker create machine end', { elapsed_sec: (new Date().getTime() - startTime) / 1000 })
            return machineFromDeployment(deployment)
          }
        )(),
      })
    },

    ensureMachineSnapshot: async () => undefined,
    getMachineAndSpecDiff: async ({ envId }) => {
      const deployment = await client.findMostRecentDeployment(envId)
      if (!deployment) {
        return undefined
      }

      return {
        ...machineFromDeployment(deployment),
        specDiff: await client.matchesCurrentTemplate(deployment)
          ? [{ name: 'template', old: 'old', new: 'current' }]
          : [],
      }
    },
  }
}

export const factory: MachineCreationDriverFactory<
  Interfaces.InferredFlags<typeof flags>,
  DeploymentMachine
> = (f, profile) => machineCreationDriver({
  profileId: profile.id,
  ...machineCreationContextFromFlags(f),
})

export default machineCreationDriver
