import { jsonReader } from './fs'
import { Snapshot, snapshotStore } from './snapshot'

export * from './tar'
export { VirtualFS, jsonReader, fsTypeFromUrl, localFsFromUrl, localFs } from './fs'

export const store = (
  snapshotter: (dir: string) => Promise<Snapshot>,
) => {
  const s = (dir: string) => snapshotStore(() => snapshotter(dir))
  return ({
    ref: (dir: string) => {
      const read = async (file: string) => await (s(dir)).ref().read(file)

      return ({
        read,
        ...jsonReader({ read }),
      })
    },
    transaction: async <T>(
      dir: string,
      op: (s: Pick<Snapshot, 'write' | 'delete' | 'read'>) => Promise<T>,
    ) => await s(dir).transaction(op),
  })
}

export type Store = ReturnType<typeof store>
