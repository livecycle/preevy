import { Flags, Interfaces } from '@oclif/core'
import { MachineCreationDriver, MachineCreationDriverFactory, telemetryEmitter } from '@preevy/core'
import { DeploymentMachine, machineFromDeployment } from './common'
import { DriverContext, clientFromConfiguration, machineConnection, flags as machineDriverFlags } from './driver'

type MachineCreationDriverContext = DriverContext & { serverSideApply: boolean }

export const flags = {
  ...machineDriverFlags,
  'server-side-apply': Flags.boolean({
    description: 'Use server side apply to create Kubernetes resources',
    default: true,
    required: false,
    allowNo: true,
  }),
} as const

export type MachineCreationFlagTypes = Omit<Interfaces.InferredFlags<typeof flags>, 'json'>

const machineCreationDriver = (
  { client, serverSideApply }: MachineCreationDriverContext,
): MachineCreationDriver<DeploymentMachine> => ({
  createMachine: async ({ envId }) => {
    const startTime = new Date().getTime()
    telemetryEmitter().capture('kube-docker create machine start', {})

    return ({
      fromSnapshot: true,
      result: (async () => {
        const deployment = await client.createEnv(envId, { serverSideApply })
        const machine = machineFromDeployment(deployment)
        telemetryEmitter().capture('kube-docker create machine end', { elapsed_sec: (new Date().getTime() - startTime) / 1000 })
        const connection = await machineConnection(client, machine)
        return { machine, connection }
      })(),
    })
  },

  ensureMachineSnapshot: async () => undefined,
  getMachineAndSpecDiff: async ({ envId }) => {
    const deployment = await client.findMostRecentDeployment({ envId, deleted: false })
    if (!deployment) {
      return undefined
    }

    const deploymentHash = client.extractTemplateHash(deployment)
    const machine = machineFromDeployment(deployment)
    const templateHash = await client.calcTemplateHash({ instance: machine.providerId })

    return {
      ...machineFromDeployment(deployment),
      specDiff: deploymentHash !== templateHash
        ? [{ name: 'template', old: deploymentHash, new: templateHash }]
        : [],
    }
  },
})

export const factory: MachineCreationDriverFactory<
  Interfaces.InferredFlags<typeof flags>,
  DeploymentMachine
> = ({ flags: f, profile: { id: profileId }, log, debug }) => machineCreationDriver({
  log,
  debug,
  client: clientFromConfiguration({ log, flags: f, profileId }),
  serverSideApply: f['server-side-apply'],
})

export default machineCreationDriver
