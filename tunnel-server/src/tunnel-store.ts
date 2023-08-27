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

const sanitizeHostName = (x:string) => x.replace(/[^a-zA-Z0-9_-]/g, '-').toLocaleLowerCase()

/**
Generate a key for tunnel store.
Return value should be safe to use as DNS subdomain.
Constraints:
- max length is 63 octets (== 63 ASCII chars)
- case insensitive
*/
export const activeTunnelStoreKey = (clientId: string, remotePath: string) => {
  if (clientId !== sanitizeHostName(clientId)) {
    throw new Error('Invalid client id')
  }

  const tunnelPath = remotePath.replace(/^\//, '')
  const tunnelPathLength = MAX_DNS_LABEL_LENGTH - clientId.length - 1
  const truncatedPath = truncateWithHash(
    tunnelPath,
    sanitizeHostName,
    tunnelPathLength,
  )
  return `${truncatedPath}-${clientId}`
}
