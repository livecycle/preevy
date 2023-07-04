import * as k8s from '@kubernetes/client-node'
import { asyncConcat } from 'iter-tools-es'
import { paginationIterator } from './pagination'

const excludedResources = ['events', 'nodes']

const listResources = async ({ namespace, k8sApi, kc }: {
  namespace: string
  kc: Pick<k8s.KubeConfig, 'makeApiClient'>
  k8sApi: k8s.CoreV1Api
}) => {
  type ApiConstructor = Parameters<typeof kc.makeApiClient>[0]
  type ListFunc = k8s.CoreV1Api['listNamespacedConfigMap']
  const listFuncs = (await k8sApi.getAPIResources()).body.resources
    .filter(r => r.namespaced && !excludedResources.includes(r.name) && r.verbs.includes('list'))
    .map(r => {
      const group = r.group ?? 'CoreV1Api'
      const ctor = k8s[group as keyof typeof k8s]
      if (!ctor) {
        return undefined
      }
      let api: k8s.ApiType
      try {
        api = kc.makeApiClient(ctor as ApiConstructor)
      } catch (e) {
        return undefined
      }

      const listFunctionName = `listNamespaced${r.kind}`
      const listFunction = api[listFunctionName as keyof typeof api]
      if (typeof listFunction !== 'function') {
        return undefined
      }

      return listFunction.bind(api) as ListFunc
    })
    .filter(Boolean) as ListFunc[]

  return ({ fieldSelector, labelSelector }: {
    fieldSelector?: string
    labelSelector?: string
  } = {}) => asyncConcat(...listFuncs.map(f => paginationIterator(continueToken => f(
    namespace,
    undefined,
    undefined,
    continueToken,
    fieldSelector,
    labelSelector,
  ))))
}

export default listResources
