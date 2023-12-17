import { Flags, Interfaces } from '@oclif/core'
import { MachineCreationDriver, MachineCreationDriverFactory, telemetryEmitter } from '@preevy/core'
import { pick } from 'lodash-es'
import { DeploymentMachine, machineFromDeployment } from './common.js'
import { DriverContext, clientFromConfiguration, machineConnection, flags as machineDriverFlags } from './driver.js'

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

type MachineCreationDriverContext = DriverContext & {
  serverSideApply: boolean
  metadata: MachineCreationFlagTypes
}

const machineCreationDriver = (
  { client, serverSideApply, log, metadata }: MachineCreationDriverContext,
): MachineCreationDriver<DeploymentMachine> => ({
  metadata,
  createMachine: async ({ envId }) => {
    const startTime = new Date().getTime()
    telemetryEmitter().capture('kube-pod create machine start', {})

    return ({
      fromSnapshot: true,
      result: (async () => {
        log.debug('create machine', { envId, serverSideApply })
        const deployment = await client.createEnv(envId, { serverSideApply })
        const machine = machineFromDeployment(deployment)
        telemetryEmitter().capture('kube-pod create machine end', { elapsed_sec: (new Date().getTime() - startTime) / 1000 })
        const connection = await machineConnection(client, machine, log)
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
  metadata: pick(f, Object.keys(machineDriverFlags)) as MachineCreationFlagTypes, // filter out non-driver flags
  log,
  debug,
  client: clientFromConfiguration({ log, flags: f, profileId }),
  serverSideApply: f['server-side-apply'],
})

export default machineCreationDriver
