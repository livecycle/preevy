import * as k8s from '@kubernetes/client-node'
import { HasRequired, ensureDefined } from '@preevy/core'
import { asyncConcat, asyncMap } from 'iter-tools-es'
import { defaults } from 'lodash'
import { paginationIterator } from '../pagination'
import apply from './apply'
import waiter from './wait'
import { FuncWrapper } from '../log-error'

const dynamicApi = (
  { client, wrap }: { client: k8s.KubernetesObjectApi; wrap: FuncWrapper },
) => {
  const list = (
    types: { apiVersion: string; kind: string; namespace?: string }[],
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

  const gatherTypes = (...specs: k8s.KubernetesObject[]) => {
    const docs = specs.map(s => ensureDefined(s, 'apiVersion', 'kind', 'metadata'))
    type Doc = HasRequired<k8s.KubernetesObject, 'apiVersion' | 'kind' | 'metadata'>
    const key = ({ apiVersion, kind, metadata: { namespace } }: Doc) => [apiVersion, kind, namespace].join(':')
    const uniques = new Map(docs.map(d => [key(d), {
      apiVersion: d.apiVersion,
      kind: d.kind,
      namespace: d.metadata.namespace,
    }])).values()
    return [...uniques]
  }

  return {
    list,
    gatherTypes,
    apply: apply({ client, wrap }),
    waiter: (watcher: k8s.Watch) => waiter({ watcher, client }),
  }
}

export default dynamicApi

export { applyStrategies, applyStrategy, ApplyStrategy, compositeApplyFilter, ApplyFilter } from './apply'
