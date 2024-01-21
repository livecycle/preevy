import { createHash } from 'crypto'
import { ListenOptions } from 'net'
import stringifyModule from 'fast-safe-stringify'
import * as k8s from '@kubernetes/client-node'
import nunjucks from 'nunjucks'
import yaml from 'yaml'
import { asyncToArray, asyncFirst } from 'iter-tools-es'
import { maxBy } from 'lodash-es'
import { inspect } from 'util'
import { Logger } from '@preevy/core'
import baseExec from './exec/index.js'
import dynamicApi, { ApplyFilter, KubernetesType, applyStrategies, compositeApplyFilter } from './dynamic/index.js'
import basePortForward from './port-forward.js'
import {
  podHelpers as createPodHelpers,
  appsV1ApiHelpers as createAppsV1ApiHelpers,
  coreV1ApiHelpers as createCoreV1ApiHelpers,
} from './k8s-helpers.js'
import {
  LABELS,
  addEnvMetadata,
  envRandomName,
  envSelector,
  markObjectAsDeleted,
  profileSelector,
  instanceSelector,
  extractTemplateHash,
  extractCreatedAt,
  extractName,
  isDockerHostStatefulSet,
  addAllTypesAnnotation,
  readAllTypesAnnotation,
} from './metadata.js'
import { Package } from './common.js'
import { logError } from './log-error.js'

const stringify = stringifyModule.default

export const loadKubeConfig = ({ kubeconfig, context }: { kubeconfig?: string; context?: string }) => {
  const kc = new k8s.KubeConfig()
  if (kubeconfig) {
    kc.loadFromFile(kubeconfig)
  } else {
    kc.loadFromDefault()
  }
  if (context) {
    kc.setCurrentContext(context)
  }
  return kc
}

export class DuplicateDockerHostStatefulSet extends Error {
  constructor(readonly dups: [k8s.KubernetesObject, k8s.KubernetesObject]) {
    super(`Duplicate Docker host StatefulSets found: ${inspect(dups)}`)
  }
}

const ensureSingleDockerHostStatefulSet = (
  transform: (o: k8s.V1StatefulSet) => k8s.V1StatefulSet = o => o,
): ApplyFilter => {
  let statefulSet: k8s.KubernetesObject
  return s => {
    if (isDockerHostStatefulSet(s)) {
      if (statefulSet) {
        throw new DuplicateDockerHostStatefulSet([statefulSet, s])
      }
      statefulSet = transform(s)
    }
    return s
  }
}

const noForever: k8s.Interceptor = (opts => { opts.forever = false })
type HasAddInterceptor = { addInterceptor(interceptor: k8s.Interceptor): void }
const addNoForeverInterceptor = <T extends HasAddInterceptor>(o: T) => { o.addInterceptor(noForever); return o }

export const kubeClient = ({
  log,
  namespace,
  kc,
  profileId,
  kubeconfig,
}: {
  log: Logger
  kc: k8s.KubeConfig
  kubeconfig?: string
  namespace: string
  profileId: string
}) => {
  const wrap = logError(log)
  const k8sApi = addNoForeverInterceptor(kc.makeApiClient(k8s.CoreV1Api))
  const k8sAppsApi = addNoForeverInterceptor(kc.makeApiClient(k8s.AppsV1Api))

  const podHelpers = createPodHelpers({ k8sApi, k8sAppsApi, wrap })
  const appsV1ApiHelpers = createAppsV1ApiHelpers(k8sAppsApi, { wrap })
  const coreV1ApiHelpers = createCoreV1ApiHelpers(k8sApi, { wrap })

  const listEnvStatefulSets = (
    envId: string,
    deleted?: boolean,
  ) => appsV1ApiHelpers.listStatefulSets({
    namespace,
    ...envSelector({ profileId, envId, deleted, dockerHost: true }),
  })

  const listEnvDeployments = (
    envId: string,
    deleted?: boolean,
  ) => appsV1ApiHelpers.listDeployments({
    namespace,
    ...envSelector({ profileId, envId, deleted, dockerHost: true }),
  })

  const findMostRecentDeployment = async ({ envId, deleted }: {
    envId: string
    deleted?: boolean
  }): Promise<k8s.V1Deployment | undefined> => maxBy(
    await asyncToArray(listEnvDeployments(envId, deleted)),
    extractCreatedAt,
  )

  const findMostRecentStatefulSet = async ({ envId, deleted }: {
    envId: string
    deleted?: boolean
  }): Promise<k8s.V1StatefulSet | undefined> => maxBy(
    await asyncToArray(listEnvStatefulSets(envId, deleted)),
    extractCreatedAt,
  )

  const findEnvObject = async (args: {
    envId: string
    deleted?: boolean
  }): Promise<k8s.V1Deployment | k8s.V1StatefulSet | undefined> => await findMostRecentStatefulSet(args)
    ?? await findMostRecentDeployment(args)

  const portForward = async (
    statefulSet: k8s.V1StatefulSet,
    targetPort: number,
    listenAddress: number | string | ListenOptions,
  ) => {
    const forward = new k8s.PortForward(kc)
    const pod = await podHelpers.findReadyPodForStatefulSet(statefulSet)
    const podName = extractName(pod)
    return await basePortForward({ namespace, forward, log })(podName, targetPort, listenAddress)
  }

  const apiServiceClusterAddress = async (): Promise<[string, number] | undefined> => {
    const service = await asyncFirst(coreV1ApiHelpers.listServices({
      namespace: 'default',
      fieldSelector: 'metadata.name=kubernetes',
    }))
    const [host, port] = [service?.spec?.clusterIP, service?.spec?.ports?.[0]?.port]
    if (host === undefined || port === undefined) {
      return undefined
    }
    return [host, port]
  }

  return {
    findEnvObject,
    findMostRecentDeployment,
    findMostRecentStatefulSet,
    listProfileStatefulSets: () => appsV1ApiHelpers.listStatefulSets({ namespace, ...profileSelector({ profileId }) }),
    listProfileDeployments: () => appsV1ApiHelpers.listDeployments({ namespace, ...profileSelector({ profileId }) }),
    exec: baseExec({ kubeConfig: kc, kubeconfigLocation: kubeconfig, namespace, log }),
    findReadyPod: podHelpers.findReadyPod,
    portForward,
    apiServiceClusterAddress,
  }
}

export type Client = ReturnType<typeof kubeClient>

export const kubeCreationClient = ({
  log,
  namespace,
  kc,
  profileId,
  template,
  package: packageDetails,
  storageClass,
  storageSize,
}: {
  log: Logger
  kc: k8s.KubeConfig
  namespace: string
  profileId: string
  template: Buffer | string | Promise<Buffer | string>
  package: Package | Promise<Package>
  storageClass: string | undefined
  storageSize: number
}) => {
  const wrap = logError(log)
  const k8sAppsApi = addNoForeverInterceptor(kc.makeApiClient(k8s.AppsV1Api))
  const k8sObjApi = addNoForeverInterceptor(kc.makeApiClient(k8s.KubernetesObjectApi))
  const watcher = new k8s.Watch(kc)

  const appsV1ApiHelpers = createAppsV1ApiHelpers(k8sAppsApi, { wrap })

  const { apply, gatherTypes, uniqueTypes, list: dynamicList, waiter } = dynamicApi({ client: k8sObjApi, wrap })

  const renderTemplate = async ({ instance }: { instance: string }) => {
    const specsStr = nunjucks.renderString((await template).toString('utf-8'), {
      id: instance,
      namespace,
      storageClass,
      storageSize,
      labels: {
        [LABELS.PROFILE_ID]: profileId,
        [LABELS.INSTANCE]: instance,
      },
    })
    return yaml.parseAllDocuments(specsStr).map(d => d.toJS() as k8s.KubernetesObject)
  }

  const calcTemplateHash = async (
    args: { instance: string } | { specs: k8s.KubernetesObject[] },
  ) => `sha1:${createHash('sha1').update(
    stringify.stableStringify('instance' in args ? await renderTemplate(args) : args.specs)
  ).digest('base64')}`

  const findInstanceStatefulSet = async (instance: string) => {
    const statefulSet = await asyncFirst(appsV1ApiHelpers.listStatefulSets({
      namespace,
      ...instanceSelector({ instance }),
    }))

    if (!statefulSet) {
      throw new Error(`Cannot find StatefulSet with label "${LABELS.INSTANCE}": "${instance}" in namespace "${namespace}"`)
    }
    return statefulSet
  }

  const findInstanceAllTypesFromMetadata = async (instance: string): Promise<KubernetesType[]> => {
    const statefulSet = await findInstanceStatefulSet(instance).catch(() => undefined)
    const allTypes = statefulSet ? readAllTypesAnnotation(statefulSet) : undefined
    return (allTypes ?? []).map(t => ({ ...t, namespace }))
  }

  const findInstanceAllTypes = async (instance: string): Promise<KubernetesType[]> => uniqueTypes([
    ...await findInstanceAllTypesFromMetadata(instance),
    ...gatherTypes(...await renderTemplate({ instance: '' })),
    { kind: 'Deployment', apiVersion: 'apps/v1', namespace }, // backwards compatibility with Deployment-based envs
  ])

  const listInstanceObjects = async (
    instance: string,
  ) => dynamicList(
    await findInstanceAllTypes(instance),
    { ...instanceSelector({ instance }) },
  )

  const createEnv = async (
    envId: string,
    { serverSideApply }: { serverSideApply: boolean },
  ) => {
    const instance = envRandomName({ envId, profileId })
    const specs = await renderTemplate({ instance })
    const templateTypes = gatherTypes(...specs)
      .map(({ kind, apiVersion, namespace: ns }) => ({ kind, apiVersion, namespaced: ns !== undefined }))

    const allTypes = uniqueTypes([
      { kind: 'PersistentVolumeClaim', apiVersion: 'v1', namespace }, // PVC associated with StatefulSet (they are not part of the template)
      ...templateTypes,
    ])

    log.debug('createEnv: apply', instance, inspect(specs, { depth: null }))
    await apply(specs, {
      filter: compositeApplyFilter(
        ensureSingleDockerHostStatefulSet(s => addAllTypesAnnotation(s, allTypes)),
        addEnvMetadata({
          profileId,
          envId,
          createdAt: new Date(),
          instance,
          package: await packageDetails,
          templateHash: await calcTemplateHash({ specs }),
        })
      ),
      strategy: serverSideApply
        ? applyStrategies.serverSideApply({ fieldManager: (await packageDetails).name })
        : applyStrategies.clientSideApply,
    })

    log.debug('createEnv: findInstanceStatefulSet', instance)
    const statefulSet = await findInstanceStatefulSet(instance)

    return await waiter(watcher).waitForEvent(
      statefulSet,
      (_phase, ss) => ss.status?.readyReplicas === ss.spec?.replicas,
    )
  }

  const deleteEnv = async (
    instance: string,
    { wait }: { wait: boolean },
  ) => {
    const objects = await asyncToArray(await listInstanceObjects(instance))
    await apply(objects, {
      filter: markObjectAsDeleted,
      strategy: applyStrategies.patch({ ignoreNonExisting: true }),
    })
    await apply(objects, { strategy: wait ? applyStrategies.deleteAndWait(watcher) : applyStrategies.delete })
  }

  return {
    createEnv,
    deleteEnv,
    extractTemplateHash,
    calcTemplateHash,
  }
}

export type CreationClient = ReturnType<typeof kubeCreationClient>

export { extractInstance, extractEnvId, extractName, extractNamespace, extractTemplateHash } from './metadata.js'
export { DeploymentNotReadyError, DeploymentNotReadyErrorReason } from './k8s-helpers.js'
