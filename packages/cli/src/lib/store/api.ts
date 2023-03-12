import { VirtualFS, Snapshot, Snapshotter } from './types'
import { snapshotTransactor } from './utils'

export function createStore(
  vfs: VirtualFS,
  snapshotter: Snapshotter
) {
  const transactor = snapshotTransactor(snapshotter)

  return {
    ref(dir: string) {
      async function read(file: string) {
        const dirData = await vfs.read(dir)
        if (!dirData) return undefined
        return transactor.readFromSnapshot(dirData, s => s.read(file))
      }
      async function readOrThrow(file: string) {
        const data = await read(file)
        if (!data) {
          throw new Error('missing data')
        }
        return data
      }
      return {
        async list() {
          const data = await vfs.read(dir)
          if (!data) return []
          return transactor.readFromSnapshot(data, s => s.list())
        },
        read,
        async readJSON<T>(file:string) {
          const data = await read(file)
          if (!data) return undefined
          return JSON.parse(data.toString()) as T
        },
        async readJsonOrThrow<T>(file: string) {
          const data = await readOrThrow(file)
          return JSON.parse(data.toString()) as T
        },
      }
    },
    async transaction(dir: string, op: (s: Pick<Snapshot, 'write' | 'delete' | 'list' | 'read'>) => Promise<void>) {
      const data = await vfs.read(dir)
      return vfs.write(dir, await transactor.writeToSnapshot(data, op))
    },
  }
}

export type Store = ReturnType<typeof createStore>
