import { KeyObject } from 'crypto'
import EventEmitter from 'events'

export type PreviewEnv = {
  clientUniqueId: string
  hostnameSuffix: string
  target: string
  publicKey: KeyObject
  access: 'private' | 'public'
}

export type PreviewEnvStore = {
  get: (key: string) => Promise<PreviewEnv | undefined>
  set: (key: string, env: PreviewEnv) => Promise<void>
  has: (key: string) => Promise<boolean>
  delete: (key: string, clientUniqueId: string) => Promise<boolean>
}

export const inMemoryPreviewEnvStore = (initial?: Record<string, PreviewEnv>): PreviewEnvStore => {
  const map = new Map<string, PreviewEnv>(Object.entries(initial ?? {}))
  const emitter = new EventEmitter()
  return Object.assign(emitter, {
    get: async (key: string) => map.get(key),
    set: async (key: string, value: PreviewEnv) => {
      map.set(key, value)
    },
    has: async (key: string) => map.has(key),
    delete: (key: string, clientUniqueId: string) => new Promise<boolean>(resolve => {
      const existing = map.get(key)
      if (!existing || existing.clientUniqueId !== clientUniqueId) {
        resolve(false)
        return
      }
      map.delete(key)
      resolve(true)
      emitter.emit('deleted', key)
    }),
  })
}
