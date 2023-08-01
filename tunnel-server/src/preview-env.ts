import { KeyObject } from 'crypto'

export type PreviewEnv = {
  clientId: string
  target: string
  hostname: string
  publicKey: KeyObject
  publicKeyThumbprint: string
  access: 'private' | 'public'
}

export type PreviewEnvStore = {
  get: (key: string) => Promise<PreviewEnv | undefined>
  getByPkThumbprint: (pkThumbprint: string) => Promise<PreviewEnv[] | undefined>
  set: (key: string, env: PreviewEnv) => Promise<void>
  has: (key: string) => Promise<boolean>
  delete: (key: string) => Promise<boolean>
}

export const inMemoryPreviewEnvStore = (): PreviewEnvStore => {
  const tunnelNameToEnv = new Map<string, PreviewEnv>()
  const pkThumbprintToEnv = new Map<string, PreviewEnv[]>()

  return {
    get: async key => tunnelNameToEnv.get(key),
    getByPkThumbprint: async pkThumbprint => pkThumbprintToEnv.get(pkThumbprint),
    set: async (key, value) => {
      tunnelNameToEnv.set(key, value)
      pkThumbprintToEnv.set(
        value.publicKeyThumbprint,
        [...pkThumbprintToEnv.get(value.publicKeyThumbprint) ?? [], value]
      )
    },
    has: async key => tunnelNameToEnv.has(key),
    delete: async key => tunnelNameToEnv.delete(key),
  }
}
