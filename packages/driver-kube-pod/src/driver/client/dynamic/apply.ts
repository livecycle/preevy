import * as k8s from '@kubernetes/client-node'
import { pSeries } from '@preevy/core'
import { inspect } from 'util'
import { bodyOrUndefined } from '../common'
import waiter from './wait'
import { FuncWrapper } from '../log-error'

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

export const applyStrategies = {
  serverSideApply: ({ fieldManager }: { fieldManager: string }) => applyStrategy(async (o, spec, cl) => {
    const p = await cl.patch(spec, undefined, undefined, fieldManager, undefined, {
      headers: { 'Content-Type': k8s.PatchUtils.PATCH_FORMAT_APPLY_YAML },
    })
    return p.body
  }),
  clientSideApply: applyStrategy(async (o, spec, cl) => {
    const p = await (o ? cl.patch(spec) : cl.create(spec))
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
  deleteAndWait: (watcher: k8s.Watch) => applyStrategy(async (o, spec, cl) => {
    if (!o) {
      return undefined
    }
    const deletionPromise = waiter({ watcher, client: cl }).waitForDeletion(o)
    await applyStrategies.delete(o, spec, cl)
    return await deletionPromise.then(() => undefined)
  }, { concurrent: true }),
} as const

export const compositeApplyFilter = (...filters: ApplyFilter[]): ApplyFilter => (s, i) => filters.reduce(
  (acc: k8s.KubernetesObject | undefined, f) => acc && f(acc, i),
  s,
)

const normalizeSpec = (spec: k8s.KubernetesObject) => {
  if (!spec.metadata || !spec.metadata.name || !spec.kind) {
    throw new Error(`Missing metadata or kind: ${inspect(spec)}`)
  }

  spec.metadata.namespace ||= 'default'
  spec.metadata.annotations ||= {}
  delete spec.metadata.annotations['kubectl.kubernetes.io/last-applied-configuration']
  // spec.metadata.annotations['kubectl.kubernetes.io/last-applied-configuration'] = JSON.stringify(spec)

  return spec
}

const booleanFilter = <T>(v: T | undefined | null): v is T => v !== undefined && v !== null

const apply = (
  { client, wrap }: { client: k8s.KubernetesObjectApi; wrap: FuncWrapper },
) => async <T>(
  s: k8s.KubernetesObject[],
  { filter = x => x, strategy }: {
    filter?: ApplyFilter
    strategy: ApplyStrategy<T>
  },
) => {
  const filteredSpecs = s.map(normalizeSpec).map(filter).filter(booleanFilter)

  const concurrencyFunc = strategy.concurrent
    ? (factories: (() => Promise<T>)[]) => Promise.all(factories.map(f => f()))
    : pSeries

  // eslint false positive here on case-sensitive filesystems due to unknown type
  // eslint-disable-next-line @typescript-eslint/return-await
  return await concurrencyFunc(filteredSpecs.map(spec => wrap(async () => {
    const o = await bodyOrUndefined<k8s.KubernetesObject>(
      client.read(spec as { metadata: { name: string; namespace: string }})
    )
    return await strategy(o, spec, client)
  })))
}

export default apply
