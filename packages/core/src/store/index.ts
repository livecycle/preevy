import { Snapshot, snapshotStore } from './snapshot'

export * from './tar'
export { VirtualFS, jsonReader, fsTypeFromUrl, localFsFromUrl, localFs } from './fs'

export type TransactionOp<T> = (s: Pick<Snapshot, 'write' | 'delete' | 'read'>) => Promise<T>

export const store = (
  snapshotter: (dir: string) => Promise<Snapshot>,
) => {
  const s = (dir: string) => snapshotStore(() => snapshotter(dir))
  return ({
    ref: (dir: string) => ({
      read: async (file: string) => await (s(dir)).ref().read(file),
    }),
    transaction: async <T>(dir: string, op: TransactionOp<T>) => await s(dir).transaction(op),
  })
}

export type Store = ReturnType<typeof store>
