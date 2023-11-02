import { createHash } from 'crypto'
import { ListenOptions } from 'net'
import stringify from 'fast-safe-stringify'
import * as k8s from '@kubernetes/client-node'
import nunjucks from 'nunjucks'
import yaml from 'yaml'
import { asyncToArray, asyncFirst } from 'iter-tools-es'
import { maxBy } from 'lodash'
import { inspect } from 'util'
import { Logger } from '@preevy/core'
import baseExec from './exec'
import dynamicApi, { ApplyFilter, applyStrategies, compositeApplyFilter } from './dynamic'
import basePortForward from './port-forward'
import k8sHelpers from './k8s-helpers'
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
  isDockerHostDeployment,
  ANNOTATIONS,
} from './metadata'
import { Package } from './common'
import { logError } from './log-error'

export const loadKubeConfig = (kubeconfig?: string, context?: string) => {
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

export class DuplicateDockerHostDeployment extends Error {
  constructor(readonly dups: [k8s.KubernetesObject, k8s.KubernetesObject]) {
    super(`Duplicate Docker host Deployments found: ${inspect(dups)}`)
  }
}

const ensureSingleDockerHostDeployment = (): ApplyFilter => {
  let deployment: k8s.KubernetesObject
  return s => {
    if (isDockerHostDeployment(s)) {
      if (deployment) {
        throw new DuplicateDockerHostDeployment([deployment, s])
      }
      deployment = s
    }
    return s
  }
}

const kubeClient = ({ log, namespace, kc, profileId, template, package: packageDetails, kubeconfig }: {
  log: Logger
  kc: k8s.KubeConfig
  kubeconfig?: string
  namespace: string
  profileId: string
  template: Buffer | string | Promise<Buffer | string>
  package: Package | Promise<Package>
}) => {
  const wrap = logError(log)
  const k8sApi = kc.makeApiClient(k8s.CoreV1Api)
  const k8sAppsApi = kc.makeApiClient(k8s.AppsV1Api)
  const k8sObjApi = kc.makeApiClient(k8s.KubernetesObjectApi)
  const watcher = new k8s.Watch(kc)

  const helpers = k8sHelpers({ k8sApi, k8sAppsApi, wrap })

  const { apply, gatherTypes, list: dynamicList, waiter } = dynamicApi({ client: k8sObjApi, wrap })

  const renderTemplate = async ({ instance }: { instance: string }) => {
    const specsStr = nunjucks.renderString((await template).toString('utf-8'), {
      id: instance,
      namespace,
    })
    return yaml.parseAllDocuments(specsStr).map(d => d.toJS() as k8s.KubernetesObject)
  }

  const calcTemplateHash = async ({ instance }: { instance: string }) => `sha1:${createHash('sha1').update(
    stringify.stableStringify(await renderTemplate({ instance }))
  ).digest('base64')}`

  const listInstanceObjects = async (instance: string) => dynamicList(
    gatherTypes(...await renderTemplate({ instance: '' })),
    { ...instanceSelector({ instance }) },
  )

  const findInstanceDeployment = async (instance: string) => {
    const deployment = await asyncFirst(helpers.listDeployments({ namespace, ...instanceSelector({ instance }) }))
    if (!deployment) {
      throw new Error(`Cannot find deployment with label "${LABELS.INSTANCE}": "${instance}" in namespace "${namespace}"`)
    }
    return deployment
  }

  const createEnv = async (
    envId: string,
    { serverSideApply }: { serverSideApply: boolean },
  ) => {
    const instance = envRandomName({ envId, profileId })
    const specs = await renderTemplate({ instance })
    log.debug('createEnv: apply', instance, inspect(specs, { depth: null }))
    await apply(specs, {
      filter: compositeApplyFilter(
        ensureSingleDockerHostDeployment(),
        addEnvMetadata({
          profileId,
          envId,
          createdAt: new Date(),
          instance,
          package: await packageDetails,
          templateHash: await calcTemplateHash({ instance }),
        })
      ),
      strategy: serverSideApply
        ? applyStrategies.serverSideApply({ fieldManager: (await packageDetails).name })
        : applyStrategies.clientSideApply,
    })

    log.debug('createEnv: findInstanceDeployment', instance)
    const deployment = await findInstanceDeployment(instance)

    // objects returned by the list API missing 'kind' and 'apiVersion' props
    // https://github.com/kubernetes/kubernetes/issues/3030
    deployment.kind ??= deployment.metadata?.annotations?.[ANNOTATIONS.KUBERNETES_KIND] ?? 'Deployment'
    deployment.apiVersion ??= deployment.metadata?.annotations?.[ANNOTATIONS.KUERBETES_API_VERSION] ?? 'apps/v1'

    return await waiter(watcher).waitForEvent(
      deployment,
      (_phase, d) => Boolean(d.status?.conditions?.some(({ type, status }) => type === 'Available' && status === 'True')),
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

  const listEnvDeployments = (
    envId: string,
    deleted?: boolean,
  ) => helpers.listDeployments({
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

  const portForward = async (
    deployment: k8s.V1Deployment,
    targetPort: number,
    listenAddress: number | string | ListenOptions,
  ) => {
    const forward = new k8s.PortForward(kc)
    const pod = await helpers.findReadyPodForDeployment(deployment)
    const podName = extractName(pod)
    return await basePortForward({ namespace, forward, log })(podName, targetPort, listenAddress)
  }

  const apiServiceClusterAddress = async (): Promise<[string, number] | undefined> => {
    const service = await asyncFirst(helpers.listServices({
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
    findMostRecentDeployment,
    listProfileDeployments: () => helpers.listDeployments({ namespace, ...profileSelector({ profileId }) }),
    exec: baseExec({ kubeConfig: kc, kubeconfigLocation: kubeconfig, namespace, log }),
    findReadyPodForDeployment: helpers.findReadyPodForDeployment,
    createEnv,
    deleteEnv,
    portForward,
    extractTemplateHash,
    calcTemplateHash,
    apiServiceClusterAddress,
  }
}

export type Client = ReturnType<typeof kubeClient>

export { extractInstance, extractEnvId, extractName, extractNamespace, extractTemplateHash } from './metadata'
export { DeploymentNotReadyError, DeploymentNotReadyErrorReason } from './k8s-helpers'

export default kubeClient
