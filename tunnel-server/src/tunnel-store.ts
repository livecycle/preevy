import { KeyObject } from 'crypto'
import { Logger } from 'pino'
import { truncateWithHash } from './strings'

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
    delete: async key => {
      const tunnel = keyToTunnel.get(key)
      if (tunnel) {
        removeFromIndex(key, tunnel.publicKeyThumbprint)
      }
      return keyToTunnel.delete(key)
    },
  }
}

const MAX_DNS_LABEL_LENGTH = 63

export const activeTunnelStoreKey = (clientId: string, remotePath: string) => {
  // return value needs to be DNS safe:
  // - max DNS label name length is 63 octets (== 63 ASCII chars)
  // - case insensitive
  const tunnelPath = remotePath.substring(1)
  const tunnelPathLength = MAX_DNS_LABEL_LENGTH - clientId.length - 1
  const truncatedPath = truncateWithHash(
    tunnelPath,
    x => x.replace(/^\//, '').replace(/[^a-zA-Z0-9_-]/g, '-'),
    tunnelPathLength,
  )
  return `${truncatedPath}-${clientId}`.toLowerCase()
}
