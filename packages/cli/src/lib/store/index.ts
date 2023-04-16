import { VirtualFS } from './fs'
import { Snapshot, SnapshotFromBuffer, snapshotTransactor } from './snapshot'

export * from './snapshot'
export * from './tar'
export { fsFromUrl, VirtualFS, jsonReader } from './fs'

export const snapshotStore = (
  vfs: VirtualFS,
  snapshotFromBuffer: SnapshotFromBuffer
) => ({
  ref: (dir: string) => ({
    read: async (file: string) => {
      const dirData = await vfs.read(dir)
      if (!dirData) {
        return undefined
      }
      const transactor = snapshotTransactor(await snapshotFromBuffer(dirData))
      return transactor.readFromSnapshot(s => s.read(file))
    },
  }),
  transaction: async (dir: string, op: (s: Pick<Snapshot, 'write' | 'delete' | 'read'>) => Promise<void>) => {
    const data = await vfs.read(dir)
    const transactor = snapshotTransactor(await snapshotFromBuffer(data))
    return vfs.write(dir, await transactor.writeToSnapshot(op))
  },
})

export type SnapshotStore = ReturnType<typeof snapshotStore>
