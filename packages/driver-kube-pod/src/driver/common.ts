import * as k8s from '@kubernetes/client-node'
import { MachineBase, machineResourceType } from '@preevy/core'
import { extractEnvId, extractInstance, extractName, extractNamespace } from './client/index.js'

export type KubernetesMachine<T extends k8s.KubernetesObject> = MachineBase & {
  kubernetesObject: T
}

export type StatefulSetMachine = KubernetesMachine<k8s.V1StatefulSet>
export type DeploymentMachine = KubernetesMachine<k8s.V1Deployment>

export type ResourceType = typeof machineResourceType

export const k8sObjectToMachine = <T extends k8s.KubernetesObject>(
  kubernetesObject: T,
): KubernetesMachine<T> => ({
  type: machineResourceType,
  providerId: extractInstance(kubernetesObject),
  locationDescription: `${kubernetesObject.kind}/${extractName(kubernetesObject)} of namespace ${extractNamespace(kubernetesObject)}`,
  envId: extractEnvId(kubernetesObject),
  kubernetesObject,
})
