import { KeyObject } from 'crypto'
import { Logger } from 'pino'
import { multimap } from '../multimap'
import { Store, TransactionDescriptor, inMemoryStore } from '../memory-store'
import { ScriptInjectionSpec } from '../proxy/injection'

export { activeTunnelStoreKey } from './key'

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
  inject?: ScriptInjectionSpec[]
  client: unknown
}

export type ActiveTunnelStore = Store<ActiveTunnel> & {
  getByPkThumbprint: (pkThumbprint: string) => Promise<readonly ActiveTunnel[] | undefined>
}

export const inMemoryActiveTunnelStore = ({ log }: { log: Logger }): ActiveTunnelStore => {
  const keyToTunnel = inMemoryStore<ActiveTunnel>({ log })
  const pkThumbprintToTunnel = multimap<string, { key: string; tx: TransactionDescriptor }>()
  const { set: storeSet } = keyToTunnel
  return Object.assign(keyToTunnel, {
    getByPkThumbprint: async (pkThumbprint: string) => {
      const entries = pkThumbprintToTunnel.get(pkThumbprint) ?? []
      const result = (
        await Promise.all(entries.map(async ({ key }) => (await keyToTunnel.get(key))?.value))
      ).filter(Boolean) as ActiveTunnel[]
      return result.length ? result : undefined
    },
    set: async (key: string, value: ActiveTunnel) => {
      const result = await storeSet(key, value)
      pkThumbprintToTunnel.add(value.publicKeyThumbprint, { key, tx: result.tx })
      result.watcher.once('delete', () => {
        pkThumbprintToTunnel.delete(
          value.publicKeyThumbprint,
          entry => entry.key === key && entry.tx.txId === result.tx.txId,
        )
      })
      return result
    },
  })
}
