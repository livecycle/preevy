import * as k8s from '@kubernetes/client-node'
import { MachineBase, machineResourceType } from '@preevy/core'
import { extractEnvId, extractInstance, extractName, extractNamespace } from './client/index.js'

export type DeploymentMachine = MachineBase & {
  deployment: k8s.V1Deployment
}

export type ResourceType = typeof machineResourceType

export const machineFromDeployment = (deployment: k8s.V1Deployment): DeploymentMachine & { envId: string } => ({
  type: machineResourceType,
  providerId: extractInstance(deployment),
  locationDescription: `deployment/${extractName(deployment)} of namespace ${extractNamespace(deployment)}`,
  envId: extractEnvId(deployment),
  deployment,
})
