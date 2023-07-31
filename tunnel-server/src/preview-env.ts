import { KeyObject } from 'crypto'

export type PreviewEnv = {
  clientId: string
  target: string
  publicKey: KeyObject
  access: 'private' | 'public'
}

export type PreviewEnvStore = {
  get: (key: string) => Promise<PreviewEnv | undefined>
  set: (key: string, env: PreviewEnv) => Promise<void>
  has: (key: string) => Promise<boolean>
  delete: (key: string) => Promise<boolean>
}

export const inMemoryPreviewEnvStore = (initial?: Record<string, PreviewEnv>): PreviewEnvStore => {
  const map = new Map<string, PreviewEnv>(Object.entries(initial ?? {}))
  return {
    get: async key => map.get(key),
    set: async (key, value) => {
      map.set(key, value)
    },
    has: async key => map.has(key),
    delete: async key => map.delete(key),
  }
}
