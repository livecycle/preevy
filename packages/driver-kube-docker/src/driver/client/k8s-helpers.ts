import * as k8s from '@kubernetes/client-node'
import { ensureDefined, extractDefined } from '@preevy/core'
import { asyncFilter, asyncFirst, asyncToArray } from 'iter-tools-es'
import { paginationIterator } from './pagination'

export type DeploymentNotReadyErrorReason = 'NoRevision' | 'NoReplicaSet' | 'NoReadyPod'
export class DeploymentNotReadyError extends Error {
  constructor(deployment: Pick<k8s.V1Deployment, 'metadata'>, readonly reason: DeploymentNotReadyErrorReason) {
    super(`No ready pod found for Deployment "${deployment.metadata?.namespace}/${deployment.metadata?.name}": ${reason}`)
  }
}

export default (
  { k8sAppsApi, k8sApi, namespace }: {
    k8sAppsApi: k8s.AppsV1Api
    k8sApi: k8s.CoreV1Api
    namespace: string
  }
) => {
  const listDeployments = (
    { fieldSelector, labelSelector, resourceVersion, timeoutSeconds, watch }: {
      fieldSelector?: string
      labelSelector?: string
      resourceVersion?: string
      timeoutSeconds?: number
      watch?: boolean
    } = {},
  ) => paginationIterator<k8s.V1Deployment>(
    continueToken => k8sAppsApi.listNamespacedDeployment(
      namespace,
      undefined,
      undefined,
      continueToken,
      fieldSelector,
      labelSelector,
      undefined,
      resourceVersion,
      undefined,
      timeoutSeconds,
      watch,
    ),
  )

  const listReplicaSets = (
    { fieldSelector, labelSelector, resourceVersion, timeoutSeconds, watch }: {
      fieldSelector?: string
      labelSelector?: string
      resourceVersion?: string
      timeoutSeconds?: number
      watch?: boolean
    } = {},
  ) => paginationIterator<k8s.V1ReplicaSet>(
    continueToken => k8sAppsApi.listNamespacedReplicaSet(
      namespace,
      undefined,
      undefined,
      continueToken,
      fieldSelector,
      labelSelector,
      undefined,
      resourceVersion,
      undefined,
      timeoutSeconds,
      watch,
    ),
  )

  const listPods = (
    { fieldSelector, labelSelector, resourceVersion, timeoutSeconds, watch }: {
      fieldSelector?: string
      labelSelector?: string
      resourceVersion?: string
      timeoutSeconds?: number
      watch?: boolean
    } = {},
  ) => paginationIterator<k8s.V1Pod>(
    continueToken => k8sApi.listNamespacedPod(
      namespace,
      undefined,
      undefined,
      continueToken,
      fieldSelector,
      labelSelector,
      undefined,
      resourceVersion,
      undefined,
      timeoutSeconds,
      watch,
    ),
  )

  const findReplicaSetForDeployment = async (deployment: Pick<k8s.V1Deployment, 'metadata'>) => {
    const { name, annotations } = ensureDefined(extractDefined(deployment, 'metadata'), 'name', 'annotations', 'labels')
    const revision = annotations['deployment.kubernetes.io/revision']
    if (!revision) {
      throw new DeploymentNotReadyError(deployment, 'NoRevision')
    }
    const result = await asyncFirst(asyncFilter<k8s.V1ReplicaSet>(
      r => r.metadata?.annotations?.['deployment.kubernetes.io/revision'] === revision
        && Boolean(r.metadata?.ownerReferences?.some(ref => ref.kind === 'Deployment' && ref.name === name)),
      listReplicaSets(),
    ))
    if (!result) {
      throw new DeploymentNotReadyError(deployment, 'NoReplicaSet')
    }
    return result
  }

  const listPodsForReplicaSet = (rs: Pick<k8s.V1ReplicaSet, 'metadata'>) => {
    const { labels, name } = ensureDefined(extractDefined(rs, 'metadata'), 'labels', 'name')
    const podTemplateHash = extractDefined(labels, 'pod-template-hash')
    return asyncFilter<k8s.V1Pod>(
      pod => Boolean(pod.metadata?.ownerReferences?.some(ref => ref.kind === 'ReplicaSet' && ref.name === name)),
      listPods({ labelSelector: `pod-template-hash=${podTemplateHash}` }),
    )
  }

  const listPodsForDeployment = async (deployment: Pick<k8s.V1Deployment, 'metadata'>) => listPodsForReplicaSet(
    await findReplicaSetForDeployment(deployment),
  )

  const findReadyPodForDeployment = async (deployment: Pick<k8s.V1Deployment, 'metadata'>) => {
    const allPods = await asyncToArray(await listPodsForDeployment(deployment))
    const pod = allPods.find(p => p.status?.conditions?.some(c => c.type === 'Ready' && c.status === 'True'))
    if (!pod) {
      throw new DeploymentNotReadyError(deployment, 'NoReadyPod')
    }
    return pod
  }

  return {
    listDeployments,
    listReplicaSets,
    listPods,
    findReadyPodForDeployment,
  }
}
