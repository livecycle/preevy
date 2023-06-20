import * as k8s from '@kubernetes/client-node'
import { HasRequired, ensureDefined, extractDefined, pSeries } from '@preevy/core'
import { inspect } from 'util'
import { asyncConcat } from 'iter-tools-es'
import { bodyOrUndefined } from './common'
import wait from './wait'
import { paginationIterator } from './pagination'

const booleanFilter = <T>(v: T | undefined | null): v is T => v !== undefined && v !== null

const normalizeSpec = (spec: k8s.KubernetesObject) => {
  if (!spec.metadata || !spec.metadata.name || !spec.kind) {
    throw new Error(`Missing metadata or kind: ${inspect(spec)}`)
  }

  spec.metadata.namespace ||= 'default'
  spec.metadata.annotations ||= {}
  delete spec.metadata.annotations['kubectl.kubernetes.io/last-applied-configuration']
  spec.metadata.annotations['kubectl.kubernetes.io/last-applied-configuration'] = JSON.stringify(spec)

  return spec
}

export type ApplyFunc<Return = k8s.KubernetesObject | undefined> = (
  existingObject: k8s.KubernetesObject | undefined,
  spec: k8s.KubernetesObject,
  client: k8s.KubernetesObjectApi,
) => Promise<Return>

export type ApplyStrategy<Return = k8s.KubernetesObject | undefined> = { concurrent: boolean } & ApplyFunc<Return>
export type ApplyFilter = (spec: k8s.KubernetesObject, index: number) => k8s.KubernetesObject | undefined

export const applyStrategy = <Return = k8s.KubernetesObject | undefined>(
  f: ApplyFunc<Return>,
  { concurrent = false }: { concurrent?: boolean } = {},
): ApplyStrategy<Return> => Object.assign(f, { concurrent })

// expose the protected method `specUriPath` in a type-safe way
class KubernetesObjectApiExtended extends k8s.KubernetesObjectApi {
  public objectKindUrl(s: k8s.KubernetesObject) {
    return this.specUriPath(s, 'create')
  }

  public objectInstanceUrl(s: k8s.KubernetesObject) {
    return this.specUriPath(s, 'read')
  }
}

export const compositeFilter = (...filters: ApplyFilter[]): ApplyFilter => (s, i) => filters.reduce(
  (acc: k8s.KubernetesObject | undefined, f) => acc && f(acc, i),
  s,
)

const objectKindUrl = (
  client: k8s.KubernetesObjectApi,
) => KubernetesObjectApiExtended.prototype.objectKindUrl.bind(client)

const dynamicApi = (
  { client }: { client: k8s.KubernetesObjectApi },
) => {
  const applyStrategies = {
    serverSideApply: applyStrategy(async (o, spec, cl) => {
      const p = await cl.patch(spec, undefined, undefined, undefined, undefined, {
        headers: { 'Content-Type': k8s.PatchUtils.PATCH_FORMAT_APPLY_YAML },
      })
      return p.body
    }),
    clientSideApply: applyStrategy(async (o, spec, cl) => {
      const p = await (o ? client.patch(spec) : cl.create(spec))
      return p.body
    }),
    patch: ({ ignoreNonExisting }: { ignoreNonExisting: boolean }) => applyStrategy(async (o, spec, cl) => {
      if (!o) {
        if (!ignoreNonExisting) {
          throw new Error(`Cannot patch - object not found: ${inspect(spec)}`)
        }
        return
      }
      await cl.patch(spec)
    }, { concurrent: true }),
    delete: applyStrategy(async (o, spec, cl) => {
      if (!o) {
        return
      }
      await cl.delete(spec)
    }, { concurrent: true }),
    deleteAndWait: (watcher: k8s.Watch) => applyStrategy<void>(async (o, spec, cl) => {
      if (!o) {
        return undefined
      }
      const url = await objectKindUrl(cl)(o)
      const { name, resourceVersion } = ensureDefined(extractDefined(o, 'metadata'), 'name', 'resourceVersion')
      const deletionPromise = wait(watcher).waitForDeletion(url, name, resourceVersion)
      await applyStrategies.delete(o, spec, cl)
      return await deletionPromise
    }, { concurrent: true }),
  } as const

  const list = (
    types: { apiVersion: string; kind: string; namespace?: string }[],
    { fieldSelector, labelSelector }: {
      fieldSelector?: string
      labelSelector?: string
    } = {},
  ) => asyncConcat(...types.map(t => paginationIterator<k8s.KubernetesObject>(continueToken => client.list(
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
  ))))

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

  const apply = async <T>(
    s: k8s.KubernetesObject[],
    { filter = x => x, strategy }: {
      filter?: ApplyFilter
      strategy: ApplyStrategy<T>
    },
  ) => {
    const filteredSpecs = s.map(normalizeSpec).map(filter).filter(booleanFilter)

    const concurrencyFunc = strategy.concurrent ? Promise.all : pSeries

    return await concurrencyFunc(filteredSpecs.map(spec => async () => {
      const o = await bodyOrUndefined<k8s.KubernetesObject>(
        client.read(spec as { metadata: { name: string; namespace: string }})
      )
      return await strategy(o, spec, client)
    }))
  }

  return { apply, applyStrategies, list, gatherTypes }
}

export default dynamicApi
