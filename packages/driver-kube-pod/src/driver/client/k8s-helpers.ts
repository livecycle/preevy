import * as k8s from '@kubernetes/client-node'
import { ensureDefined, extractDefined } from '@preevy/core'
import { asyncFilter, asyncFind, asyncFirst, asyncMap, asyncToArray } from 'iter-tools-es'
import { paginationIterator } from './pagination.js'
import { FuncWrapper } from './log-error.js'
import { ANNOTATIONS, extractNameAndNamespace } from './metadata.js'

export type DeploymentNotReadyErrorReason = 'NoRevision' | 'NoReplicaSet' | 'NoReadyPod'
export class DeploymentNotReadyError extends Error {
  constructor(deployment: Pick<k8s.V1Deployment, 'metadata'>, readonly reason: DeploymentNotReadyErrorReason) {
    super(`No ready pod found for Deployment "${deployment.metadata?.namespace}/${deployment.metadata?.name}": ${reason}`)
  }
}

export class StatefulSetNotReadyError extends Error {
  constructor(statefulSet: Pick<k8s.V1StatefulSet, 'metadata'>) {
    super(`No ready pod found for StatefulSet "${statefulSet.metadata?.namespace}/${statefulSet.metadata?.name}"`)
  }
}

const readyPodPredicate = (p: k8s.V1Pod) => Boolean(p.status?.conditions?.some(c => c.type === 'Ready' && c.status === 'True'))

// objects returned by the list API missing 'kind' and 'apiVersion' props
// https://github.com/kubernetes/kubernetes/issues/3030
const completeMissingListFields = <T extends k8s.KubernetesObject>(
  { kind, apiVersion }: { kind: string; apiVersion: string },
) => (o: T) => {
  o.kind ??= o.metadata?.annotations?.[ANNOTATIONS.KUBERNETES_KIND] ?? kind
  o.apiVersion ??= o.metadata?.annotations?.[ANNOTATIONS.KUERBETES_API_VERSION] ?? apiVersion
  return o
}

const completeMissingListFieldsAsyncIter = <T extends k8s.KubernetesObject>(
  fields: { kind: string; apiVersion: string },
  asyncIterator: AsyncIterable<T>,
) => asyncMap(
  completeMissingListFields(fields),
  asyncIterator,
)

export const storageV1ApiHelpers = (
  storageApi: k8s.StorageV1Api,
  { wrap = f => f }: { wrap?: FuncWrapper } = {}
) => {
  const listStorageClasses = (
    { fieldSelector, labelSelector, resourceVersion, timeoutSeconds, watch }: {
      fieldSelector?: string
      labelSelector?: string
      resourceVersion?: string
      timeoutSeconds?: number
      watch?: boolean
    },
  ) => completeMissingListFieldsAsyncIter(
    { kind: 'StorageClass', apiVersion: 'storage.k8s.io/v1' },
    paginationIterator<k8s.V1StorageClass>(
      wrap(continueToken => storageApi.listStorageClass(
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
      )),
    )
  )

  const findDefaultStorageClass = (storageClasses: k8s.V1StorageClass[]) => {
    const defaultStorageClass = storageClasses.find(sc => sc?.metadata?.annotations?.['storageclass.kubernetes.io/is-default-class'] === 'true')
    return defaultStorageClass
  }

  return { listStorageClasses, findDefaultStorageClass }
}

export const coreV1ApiHelpers = (
  k8sApi: k8s.CoreV1Api,
  { wrap = f => f }: { wrap?: FuncWrapper } = {}
) => {
  const listPods = (
    { namespace, fieldSelector, labelSelector, resourceVersion, timeoutSeconds, watch }: {
      namespace: string
      namespaceOverride?: string
      fieldSelector?: string
      labelSelector?: string
      resourceVersion?: string
      timeoutSeconds?: number
      watch?: boolean
    },
  ) => completeMissingListFieldsAsyncIter({ kind: 'Pod', apiVersion: 'v1' }, paginationIterator<k8s.V1Pod>(
    wrap(continueToken => k8sApi.listNamespacedPod(
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
    )),
  ))

  const listServices = (
    { namespace, fieldSelector, labelSelector, resourceVersion, timeoutSeconds, watch }: {
      namespace: string
      fieldSelector?: string
      labelSelector?: string
      resourceVersion?: string
      timeoutSeconds?: number
      watch?: boolean
    },
  ) => completeMissingListFieldsAsyncIter({ kind: 'Service', apiVersion: 'v1' }, paginationIterator<k8s.V1Service>(
    wrap(continueToken => k8sApi.listNamespacedService(
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
    )),
  ))

  return {
    listPods,
    listServices,
  }
}

export const appsV1ApiHelpers = (
  k8sAppsApi: k8s.AppsV1Api,
  { wrap = f => f }: { wrap?: FuncWrapper } = {}
) => {
  const listStatefulSets = (
    { namespace, fieldSelector, labelSelector, resourceVersion, timeoutSeconds, watch }: {
      namespace: string
      fieldSelector?: string
      labelSelector?: string
      resourceVersion?: string
      timeoutSeconds?: number
      watch?: boolean
    },
  ) => completeMissingListFieldsAsyncIter({ kind: 'StatefulSet', apiVersion: 'apps/v1' }, paginationIterator<k8s.V1StatefulSet>(
    wrap(continueToken => k8sAppsApi.listNamespacedStatefulSet(
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
    )),
  ))

  const listDeployments = (
    { namespace, fieldSelector, labelSelector, resourceVersion, timeoutSeconds, watch }: {
      namespace: string
      fieldSelector?: string
      labelSelector?: string
      resourceVersion?: string
      timeoutSeconds?: number
      watch?: boolean
    },
  ) => completeMissingListFieldsAsyncIter({ kind: 'Deployment', apiVersion: 'apps/v1' }, paginationIterator<k8s.V1Deployment>(
    wrap(continueToken => k8sAppsApi.listNamespacedDeployment(
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
    )),
  ))

  const listReplicaSets = (
    { namespace, fieldSelector, labelSelector, resourceVersion, timeoutSeconds, watch }: {
      namespace: string
      fieldSelector?: string
      labelSelector?: string
      resourceVersion?: string
      timeoutSeconds?: number
      watch?: boolean
    },
  ) => completeMissingListFieldsAsyncIter({ kind: 'ReplicaSet', apiVersion: 'apps/v1' }, paginationIterator<k8s.V1ReplicaSet>(
    wrap(continueToken => k8sAppsApi.listNamespacedReplicaSet(
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
    )),
  ))

  return {
    listStatefulSets,
    listDeployments,
    listReplicaSets,
  }
}

export const podHelpers = (
  { k8sAppsApi, k8sApi, wrap }: {
    k8sAppsApi: k8s.AppsV1Api
    k8sApi: k8s.CoreV1Api
    wrap: FuncWrapper
  }
) => {
  const { listPods } = coreV1ApiHelpers(k8sApi, { wrap })
  const { listReplicaSets } = appsV1ApiHelpers(k8sAppsApi, { wrap })

  const listPodsForStatefulSet = (ss: k8s.V1StatefulSet) => {
    const { name, namespace } = extractNameAndNamespace(ss)
    const { matchLabels } = ensureDefined(extractDefined(extractDefined(ss, 'spec'), 'selector'), 'matchLabels')
    const labelSelector = Object.entries(matchLabels).map(([k, v]) => `${k}=${v}`).join(',')
    return asyncFilter<k8s.V1Pod>(
      pod => Boolean(pod.metadata?.ownerReferences?.some(ref => ref.kind === 'StatefulSet' && ref.name === name)),
      listPods({
        namespace: namespace || '',
        labelSelector,
      }),
    )
  }

  const findReadyPodForStatefulSet = async (
    ss: k8s.V1StatefulSet,
  ) => {
    const pod = await asyncFind(readyPodPredicate, listPodsForStatefulSet(ss))
    if (!pod) {
      throw new StatefulSetNotReadyError(ss)
    }
    return pod
  }

  const findReplicaSetForDeployment = async (deployment: Pick<k8s.V1Deployment, 'metadata'>) => {
    const { name, namespace, annotations } = ensureDefined(extractDefined(deployment, 'metadata'), 'name', 'namespace', 'annotations', 'labels')
    const revision = annotations['deployment.kubernetes.io/revision']
    if (!revision) {
      throw new DeploymentNotReadyError(deployment, 'NoRevision')
    }
    const result = await asyncFirst(asyncFilter<k8s.V1ReplicaSet>(
      r => r.metadata?.annotations?.['deployment.kubernetes.io/revision'] === revision
        && Boolean(r.metadata?.ownerReferences?.some(ref => ref.kind === 'Deployment' && ref.name === name)),
      listReplicaSets({ namespace: namespace || '' }),
    ))
    if (!result) {
      throw new DeploymentNotReadyError(deployment, 'NoReplicaSet')
    }
    return result
  }

  const listPodsForReplicaSet = (rs: Pick<k8s.V1ReplicaSet, 'metadata'>) => {
    const { labels, name, namespace } = ensureDefined(extractDefined(rs, 'metadata'), 'labels', 'name')
    const podTemplateHash = extractDefined(labels, 'pod-template-hash')
    return asyncFilter<k8s.V1Pod>(
      pod => Boolean(pod.metadata?.ownerReferences?.some(ref => ref.kind === 'ReplicaSet' && ref.name === name)),
      listPods({ namespace: namespace || '', labelSelector: `pod-template-hash=${podTemplateHash}` }),
    )
  }

  const listPodsForDeployment = async (deployment: Pick<k8s.V1Deployment, 'metadata'>) => listPodsForReplicaSet(
    await findReplicaSetForDeployment(deployment),
  )

  const findReadyPodForDeployment = async (deployment: Pick<k8s.V1Deployment, 'metadata'>) => {
    const allPods = await asyncToArray(await listPodsForDeployment(deployment))
    const pod = allPods.find(readyPodPredicate)
    if (!pod) {
      throw new DeploymentNotReadyError(deployment, 'NoReadyPod')
    }
    return pod
  }

  const findReadyPod = async (obj: Pick<k8s.V1Deployment, 'metadata' | 'kind'> | k8s.V1StatefulSet) => {
    if (obj.kind === 'Deployment') {
      return await findReadyPodForDeployment(obj as k8s.V1Deployment)
    }
    return await findReadyPodForStatefulSet(obj as k8s.V1StatefulSet)
  }

  return {
    findReadyPodForStatefulSet,
    findReadyPodForDeployment,
    findReadyPod,
  }
}
