import * as k8s from '@kubernetes/client-node'

export const bodyOrUndefined = async <T, Response extends { body: T } = { body: T }>(p: Promise<Response>) => {
  try {
    const r = await p
    return r.body
  } catch (e) {
    if ((e as { statusCode: unknown }).statusCode === 404) {
      return undefined
    }
    throw e
  }
}

export const urls = {
  deployments: (namespace: string) => `apis/apps/v1/namespaces/${encodeURIComponent(namespace)}/deployments`,
} as const

export type HasMetadata = { metadata?: k8s.V1ObjectMeta }
export type Package = { version: string; name: string }
