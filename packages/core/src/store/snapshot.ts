import { VirtualFS } from './fs'

type Closable = {
  close: () => Promise<void>
}

const isClosable = (
  o: unknown
): o is Closable => typeof o === 'object' && o !== null && typeof (o as Closable).close === 'function'

const ensureClose = async <T, R>(o: T, f: (o: T) => PromiseLike<R> | R) => {
  try {
    return await f(o)
  } finally {
    if (isClosable(o)) {
      await o.close()
    }
  }
}

export type Snapshot = VirtualFS & Partial<Closable> & {
  save: () => Promise<void>
}

export const snapshotStore = (snapshotter: () => Promise<Snapshot>) => ({
  ref: (): Pick<Snapshot, 'read'> => ({
    read: async (file: string) => {
      const snapshot = await snapshotter()
      return ensureClose(snapshot, s => s.read(file))
    },
  }),
  transaction: async <T>(op: (s: Pick<Snapshot, 'write' | 'delete' | 'read'>) => Promise<T>) => {
    const snapshot = await snapshotter()
    return ensureClose(snapshot, async s => {
      const result = await op(s)
      await s.save()
      return result
    })
  },
})

export type SnapshotStore = ReturnType<typeof snapshotStore>

export type FileBackedSnapshotter = (
  fs: Pick<VirtualFS, 'read' | 'write'>,
  filename: string,
) => Promise<Snapshot>
