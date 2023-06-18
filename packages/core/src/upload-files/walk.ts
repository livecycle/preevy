import fs from 'fs'
import PQueue from 'p-queue'
import { DirInfo, FileInfo } from './files'

const readDir = async (filename: string) => fs.promises.readdir(filename)

const normalizeFile = async (local: string | FileInfo | DirInfo) => {
  const result: FileInfo | DirInfo = typeof local === 'string'
    ? { path: local, stats: await fs.promises.lstat(local) }
    : local

  if (result.stats.isSymbolicLink() && !result.symlinkTarget) {
    result.symlinkTarget = await fs.promises.readlink(result.path)
  } else if (result.stats.isDirectory() && !(result as DirInfo).entries) {
    (result as DirInfo).entries = await readDir(result.path)
  }

  return result as FileInfo | DirInfo
}

const isDir = (f: FileInfo | DirInfo): f is DirInfo => 'entries' in f

export type Visitor<T extends { local: string | FileInfo | DirInfo }> = {
  visit: (file: T, fileInfo: FileInfo) => void
  directoryEntry: (file: T, entry: string) => T
}

export const fsWalker = <T extends { local: string | FileInfo | DirInfo }>(
  concurrency: number,
  visitor: Visitor<T>,
  filesToWalk: T[]
) => {
  const queue = new PQueue({ concurrency })

  const walkFile = async (file: T): Promise<void> => {
    const fi = await normalizeFile(file.local)
    visitor.visit(file, fi)
    if (isDir(fi)) {
      // eslint-disable-next-line no-use-before-define
      void walkFiles(fi.entries.map(e => visitor.directoryEntry(file, e)))
    }
  }

  const walkFiles = (files: T[]) => {
    void queue.addAll(files.map(f => () => walkFile(f)))
  }

  walkFiles(filesToWalk)

  return queue.onIdle()
}
