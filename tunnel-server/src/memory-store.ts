import { Logger } from 'pino'
import { IEventEmitter, EventEmitter } from 'tseep'
import { nextTick } from 'process'
import { idGenerator } from './id-generator.js'

export class KeyAlreadyExistsError<V> extends Error {
  constructor(readonly key: string, readonly value: V) {
    super(`key already exists: "${key}"`)
  }
}

export type TransactionDescriptor = { readonly txId: number | string }

type StoreEvents = {
  delete: () => void
}

export interface EntryWatcher {
  once: (event: 'delete', listener: () => void) => this
}

export const inMemoryStore = <V extends {}>({ log }: { log: Logger }) => {
  type MapValue = { value: V; watcher: IEventEmitter<StoreEvents>; setTx: TransactionDescriptor }
  const map = new Map<string, MapValue>()
  const txIdGen = idGenerator()
  return {
    get: async (key: string) => {
      const entry = map.get(key)
      return entry === undefined ? undefined : { value: entry.value, watcher: entry.watcher as EntryWatcher }
    },
    set: async (key: string, value: V) => {
      const existing = map.get(key)
      if (existing !== undefined) {
        throw new KeyAlreadyExistsError<V>(key, existing.value)
      }
      const tx: TransactionDescriptor = { txId: txIdGen.next() }
      log.debug('setting key %s id %s: %j', key, tx.txId, value)
      const watcher = new EventEmitter<StoreEvents>()
      map.set(key, { value, watcher, setTx: tx })
      return { tx, watcher: watcher as EntryWatcher }
    },
    delete: async (key: string, setTx?: TransactionDescriptor) => {
      const value = map.get(key)
      if (value && (setTx === undefined || value.setTx.txId === setTx.txId) && map.delete(key)) {
        nextTick(() => { value.watcher.emit('delete') })
        return true
      }
      return false
    },
  }
}

export type Store<V extends {}> = ReturnType<typeof inMemoryStore<V>>
