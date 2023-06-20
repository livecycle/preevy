import { createHash } from 'crypto'
import { ListenOptions } from 'net'
import stringify from 'fast-safe-stringify'
import * as k8s from '@kubernetes/client-node'
import nunjucks from 'nunjucks'
import yaml from 'yaml'
import { ProcessOutputBuffers, ensureDefined, extractDefined } from '@preevy/core'
import { asyncToArray, asyncFirst } from 'iter-tools-es'
import { maxBy } from 'lodash'
import { Writable } from 'stream'
import createBaseExec, { BaseExecOpts } from './exec'
import dynamicApi, { compositeFilter } from './dynamic-api'
import basePortForward from './port-forward'
import k8sHelpers from './k8s-helpers'
import waitHelpers from './wait'
import {
  LABELS,
  addEnvMetadata,
  ensureSingleDockerHostDeployment,
  envRandomId,
  envSelector,
  markObjectAsDeleted,
  profileSelector,
  instanceSelector,
  extractTemplateHash,
  extractCreatedAt,
  extractName,
} from './metadata'
import { Package } from './common'

const DOCKER_IMAGE = 'docker:24-dind'

export type ExecOpts = Omit<BaseExecOpts, 'pod' | 'container'> & {
  deployment: k8s.V1Deployment
}

export const loadKubeConfig = (kubeconfig?: string) => {
  const kc = new k8s.KubeConfig()
  if (kubeconfig) {
    kc.loadFromFile(kubeconfig)
  } else {
    kc.loadFromDefault()
  }
  return kc
}

const kubeClient = ({ namespace, kc, profileId, template, package: packageDetails }: {
  kc: k8s.KubeConfig
  namespace: string
  profileId: string
  template: Buffer | string | Promise<Buffer | string>
  package: Package | Promise<Package>
}) => {
  const k8sApi = kc.makeApiClient(k8s.CoreV1Api)
  const k8sAppsApi = kc.makeApiClient(k8s.AppsV1Api)
  const k8sObjApi = kc.makeApiClient(k8s.KubernetesObjectApi)
  const watcher = new k8s.Watch(kc)

  const helpers = k8sHelpers({ k8sApi, k8sAppsApi, namespace })

  const { apply, applyStrategies, gatherTypes, list: dynamicList } = dynamicApi({ client: k8sObjApi })

  const deploymentMetadata = (d: Pick<k8s.V1Deployment, 'metadata'>) => ensureDefined(extractDefined(d, 'metadata'), 'name', 'namespace', 'resourceVersion')

  const renderTemplate = async ({ instance }: { instance: string }) => {
    const specsStr = nunjucks.renderString((await template).toString('utf-8'), {
      id: instance,
      namespace,
      dockerImage: DOCKER_IMAGE,
    })
    return yaml.parseAllDocuments(specsStr).map(d => d.toJS() as k8s.KubernetesObject)
  }

  const renderCanonicalTemplate = async () => await renderTemplate({ instance: '' })
  const templateHash = async () => `sha1:${createHash('sha1').update(
    stringify.stableStringify(await renderCanonicalTemplate())
  ).digest('base64')}`

  const listInstanceObjects = async (instance: string) => dynamicList(
    gatherTypes(...await renderTemplate({ instance: '' })),
    { ...instanceSelector({ instance }) },
  )

  const createEnv = async (
    envId: string,
    { serverSideApply }: { serverSideApply: boolean },
  ) => {
    const instance = envRandomId({ envId, profileId })
    const specs = await renderTemplate({ instance })
    await apply(specs, {
      filter: compositeFilter(
        ensureSingleDockerHostDeployment(),
        addEnvMetadata({
          profileId,
          envId,
          createdAt: new Date(),
          instance,
          package: await packageDetails,
          templateHash: await templateHash(),
        })
      ),
      strategy: serverSideApply ? applyStrategies.serverSideApply : applyStrategies.clientSideApply,
    })
    const deployment = await asyncFirst(helpers.listDeployments({ ...instanceSelector({ instance }) }))
    if (!deployment) {
      throw new Error(`Cannot find deployment with label "${LABELS.INSTANCE}": "${instance}" in namespace "${namespace}"`)
    }
    return deployment
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
    ...envSelector({ profileId, envId, deleted, dockerHost: true }),
  })

  const findMostRecentDeployment = async (
    envId: string,
    deleted?: boolean,
  ): Promise<k8s.V1Deployment | undefined> => maxBy(
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
    return await basePortForward({ namespace, forward })(podName, targetPort, listenAddress)
  }

  const baseExec = createBaseExec({ k8sExec: new k8s.Exec(kc), namespace })

  async function exec(opts: ExecOpts & { stdout: Writable; stderr: Writable }): Promise<{ code: number }>
  async function exec(opts: ExecOpts): Promise<{ code: number; output: ProcessOutputBuffers }>
  async function exec(
    { deployment, ...opts }: ExecOpts & { stdout?: Writable; stderr?: Writable },
  ): Promise<{ code: number; output?: ProcessOutputBuffers }> {
    const pod = await helpers.findReadyPodForDeployment(deployment)
    return await baseExec({
      pod: extractName(pod),
      container: (pod.spec?.containers[0] as k8s.V1Container).name,
      ...opts,
    })
  }

  return {
    findMostRecentDeployment,
    listProfileDeployments: () => helpers.listDeployments({ ...profileSelector({ profileId }) }),
    exec,
    findReadyPodForDeployment: helpers.findReadyPodForDeployment,
    createEnv,
    waitForDeploymentAvailable: (
      d: k8s.V1Deployment,
    ) => waitHelpers(watcher).waitForDeploymentAvailable(deploymentMetadata(d)),
    deleteEnv,
    portForward,
    matchesCurrentTemplate: async (d: k8s.V1Deployment) => extractTemplateHash(d) === await templateHash(),
  }
}

export { extractInstance, extractEnvId, extractName, extractNamespace, extractTemplateHash } from './metadata'

export default kubeClient
