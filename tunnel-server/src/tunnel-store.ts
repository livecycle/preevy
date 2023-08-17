import { KeyObject } from 'crypto'
import { Logger } from 'pino'

export type ActiveTunnel = {
  envId: string
  clientId: string
  tunnelPath: string
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
  set: (key: string, value: ActiveTunnel) => Promise<void>
  has: (key: string) => Promise<boolean>
  delete: (key: string) => Promise<boolean>
}

export const inMemoryActiveTunnelStore = ({ log }: { log: Logger }): ActiveTunnelStore => {
  const keyToTunnel = new Map<string, ActiveTunnel>()
  const pkThumbprintToTunnel = new Map<string, ActiveTunnel[]>()

  return {
    get: async key => keyToTunnel.get(key),
    getByPkThumbprint: async pkThumbprint => pkThumbprintToTunnel.get(pkThumbprint),
    set: async (key, value) => {
      log.debug('setting tunnel %s: %j', key, value)
      keyToTunnel.set(key, value)
      pkThumbprintToTunnel.set(
        value.publicKeyThumbprint,
        [...pkThumbprintToTunnel.get(value.publicKeyThumbprint) ?? [], value]
      )
    },
    has: async key => keyToTunnel.has(key),
    delete: async key => keyToTunnel.delete(key),
  }
}
