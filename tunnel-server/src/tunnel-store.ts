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
  const keyToTunnels = new Map<string, ActiveTunnel>()
  const pkThumbprintToTunnel = new Map<string, ActiveTunnel[]>()
  const removeFromIndex = (key: string, publicKeyThumbprint: string) => {
    const tunnelsForPk = pkThumbprintToTunnel.get(publicKeyThumbprint) ?? []
    const newTunnelsForPk = tunnelsForPk.filter(x => x.hostname === key)
    if (newTunnelsForPk.length === 0) {
      pkThumbprintToTunnel.delete(publicKeyThumbprint)
    } else {
      pkThumbprintToTunnel.set(publicKeyThumbprint, newTunnelsForPk)
    }
  }
  return {
    get: async key => keyToTunnels.get(key),
    getByPkThumbprint: async pkThumbprint => pkThumbprintToTunnel.get(pkThumbprint),
    set: async (key, value) => {
      log.debug('setting tunnel %s: %j', key, value)
      keyToTunnels.set(key, value)
      pkThumbprintToTunnel.set(
        value.publicKeyThumbprint,
        [...pkThumbprintToTunnel.get(value.publicKeyThumbprint) ?? [], value]
      )
    },
    has: async key => keyToTunnels.has(key),
    delete: async key => {
      const tunnel = keyToTunnels.get(key)
      if (tunnel) {
        removeFromIndex(key, tunnel.publicKeyThumbprint)
      }
      return keyToTunnels.delete(key)
    },
  }
}
