import { Snapshot, Snapshotter } from './types'

type SnapshotTransactor = {
    readFromSnapshot<T>(
      s: Buffer,
      op: (snapshot: Pick<Snapshot, 'read' | 'list'>) => Promise<T>
    ): Promise<T>
    writeToSnapshot(
      existingSnapshot: Buffer | undefined,
      op: (
        snapshot: Pick<Snapshot, 'delete' | 'list' | 'read' | 'write'>
      ) => Promise<void>
    ): Promise<Buffer>
  };

export const snapshotTransactor = (
  snapshotter: Snapshotter
):SnapshotTransactor => ({
  async readFromSnapshot(data, op) {
    const { snapshot, close } = await snapshotter.open(data)
    try {
      return await op(snapshot)
    } finally {
      await close()
    }
  },
  async writeToSnapshot(data: Buffer | undefined, op) {
    const { snapshot, save, close } = await snapshotter.open(data)
    try {
      await op(snapshot)
      return await save()
    } finally {
      await close()
    }
  },
})
