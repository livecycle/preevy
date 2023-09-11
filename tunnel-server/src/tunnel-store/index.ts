import { KeyObject } from 'crypto'
import { Logger } from 'pino'
import { arrayMap } from './array-map'

export { activeTunnelStoreKey } from './key'

export type ScriptInjection = {
  pathRegex?: RegExp
  src: string
  async?: boolean
  defer?: boolean
}

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
  inject?: ScriptInjection[]
}

export class KeyAlreadyExistsError extends Error {
  constructor(readonly key: string) {
    super(`key already exists: "${key}"`)
  }
}

export type TransactionDescriptor = { txId: number }

export type ActiveTunnelStore = {
  get: (key: string) => Promise<ActiveTunnel | undefined>
  getByPkThumbprint: (pkThumbprint: string) => Promise<readonly ActiveTunnel[] | undefined>
  set: (key: string, value: ActiveTunnel) => Promise<TransactionDescriptor>
  delete: (key: string, tx?: TransactionDescriptor) => Promise<void>
}

const idGenerator = () => {
  let nextId = 0
  return {
    next: () => {
      const result = nextId
      nextId += 1
      return result
    },
  }
}

export const inMemoryActiveTunnelStore = ({ log }: { log: Logger }): ActiveTunnelStore => {
  const keyToTunnel = new Map<string, ActiveTunnel & { txId: number }>()
  const pkThumbprintToTunnel = arrayMap<string, string>()
  const txIdGen = idGenerator()
  return {
    get: async key => keyToTunnel.get(key),
    getByPkThumbprint: async pkThumbprint => pkThumbprintToTunnel.get(pkThumbprint)
      ?.map(key => keyToTunnel.get(key) as ActiveTunnel),
    set: async (key, value) => {
      if (keyToTunnel.has(key)) {
        throw new KeyAlreadyExistsError(key)
      }
      const txId = txIdGen.next()
      log.debug('setting tunnel key %s id %s: %j', key, txId, value)
      keyToTunnel.set(key, Object.assign(value, { txId }))
      pkThumbprintToTunnel.add(value.publicKeyThumbprint, key)
      return { txId }
    },
    delete: async (key, tx) => {
      const tunnel = keyToTunnel.get(key)
      if (tunnel && (tx === undefined || tunnel.txId === tx.txId)) {
        pkThumbprintToTunnel.delete(tunnel.publicKeyThumbprint, k => k === key)
        keyToTunnel.delete(key)
      }
    },
  }
}
