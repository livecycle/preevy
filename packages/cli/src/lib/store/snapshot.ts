import { VirtualFS } from './fs'

type Closable = {
  close: () => Promise<void>
}

const ensureClose = async <T extends Closable, R>(o: T, f: (o: T) => PromiseLike<R> | R) => {
  try {
    return await f(o)
  } finally {
    await o.close()
  }
}

export type Snapshot = VirtualFS & Closable & {
  save: () => Promise<Buffer>
}

export type SnapshotFromBuffer = (existingSnapshot?: Buffer) => Promise<Snapshot>

type SnapshotTransactor = {
  readFromSnapshot<T>(
    op: (snapshot: Pick<VirtualFS, 'read'>) => Promise<T>
  ): Promise<T>
  writeToSnapshot(
    op: (
      snapshot: Pick<VirtualFS, 'delete' | 'read' | 'write'>
    ) => Promise<void>
  ): Promise<Buffer>
}

export const snapshotTransactor = (snapshot: Snapshot): SnapshotTransactor => ({
  readFromSnapshot: async op => ensureClose(snapshot, op),
  writeToSnapshot: async op => ensureClose(snapshot, async fs => {
    await op(fs)
    return fs.save()
  }),
})
