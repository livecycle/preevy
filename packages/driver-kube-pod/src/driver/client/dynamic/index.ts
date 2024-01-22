import * as k8s from '@kubernetes/client-node'
import { ensureDefined } from '@preevy/core'
import { asyncConcat, asyncMap } from 'iter-tools-es'
import { defaults } from 'lodash-es'
import { paginationIterator } from '../pagination.js'
import apply from './apply.js'
import waiter from './wait.js'
import { FuncWrapper } from '../log-error.js'

export type KubernetesType = {
  apiVersion: string
  kind: string
  namespace?: string
}

const dynamicApi = (
  { client, wrap }: { client: k8s.KubernetesObjectApi; wrap: FuncWrapper },
) => {
  const list = (
    types: KubernetesType[],
    { fieldSelector, labelSelector }: {
      fieldSelector?: string
      labelSelector?: string
    } = {},
  ) => asyncConcat(...types.map(t => asyncMap(
    // objects returned by the list API missing 'kind' and 'apiVersion' props
    // https://github.com/kubernetes/kubernetes/issues/3030
    o => defaults(o, { apiVersion: t.apiVersion, kind: t.kind }),
    paginationIterator<k8s.KubernetesObject>(
      wrap(continueToken => client.list(
        t.apiVersion,
        t.kind,
        t.namespace,
        undefined,
        undefined,
        undefined,
        fieldSelector,
        labelSelector,
        undefined,
        continueToken,
      )),
    ),
  )))

  const uniqueTypes = (types: KubernetesType[]): KubernetesType[] => [
    ...new Map(types.map(t => [[t.apiVersion, t.kind, t.namespace].join(':'), t])).values(),
  ]

  const gatherTypes = (...specs: k8s.KubernetesObject[]): KubernetesType[] => {
    const docs = specs.map(s => ensureDefined(s, 'apiVersion', 'kind', 'metadata'))
    return uniqueTypes(docs.map(({ apiVersion, kind, metadata: { namespace } }) => ({ apiVersion, kind, namespace })))
  }

  return {
    list,
    gatherTypes,
    uniqueTypes,
    apply: apply({ client, wrap }),
    waiter: (watcher: k8s.Watch) => waiter({ watcher, client }),
  }
}

export default dynamicApi

export { applyStrategies, applyStrategy, ApplyStrategy, compositeApplyFilter, ApplyFilter } from './apply.js'
