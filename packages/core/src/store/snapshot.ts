import { VirtualFS } from './fs'

export type Snapshot = VirtualFS & AsyncDisposable & {
  save: () => Promise<void>
}

export const snapshotStore = (snapshotter: () => Promise<Snapshot>) => ({
  ref: (): Pick<Snapshot, 'read'> => ({
    read: async (file: string) => {
      await using snapshot = await snapshotter()
      return await snapshot.read(file)
    },
  }),
  transaction: async <T>(op: (s: Pick<Snapshot, 'write' | 'delete' | 'read'>) => Promise<T>) => {
    await using snapshot = await snapshotter()
    const result = await op(snapshot)
    await snapshot.save()
    return result
  },
})

export type SnapshotStore = ReturnType<typeof snapshotStore>

export type FileBackedSnapshotter = (
  fs: Pick<VirtualFS, 'read' | 'write'>,
  filename: string,
) => Promise<Snapshot>
