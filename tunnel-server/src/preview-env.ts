import { KeyObject } from 'crypto'

export type ActiveTunnel = {
  envId: string
  clientId: string
  target: string
  hostname: string
  publicKey: KeyObject
  publicKeyThumbprint: string
  access: 'private' | 'public'
  meta: Record<string, unknown>
}

export type ActiveTunnelStore = {
  get: (key: string) => Promise<ActiveTunnel | undefined>
  getByPkThumbprint: (pkThumbprint: string) => Promise<ActiveTunnel[] | undefined>
  set: (key: string, env: ActiveTunnel) => Promise<void>
  has: (key: string) => Promise<boolean>
  delete: (key: string) => Promise<boolean>
}

export const inMemoryActiveTunnelStore = (): ActiveTunnelStore => {
  const tunnelNameToEnv = new Map<string, ActiveTunnel>()
  const pkThumbprintToEnv = new Map<string, ActiveTunnel[]>()

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
