import fs from 'fs'
import path from 'path'
import { sumArray } from '../../array.js'

export type FileInfo = { path: string; stats: fs.Stats; symlinkTarget?: string }

export type DirInfo = FileInfo & {
  entries: (fs.Dirent | DirInfo)[]
}

export type DirToCopy = {
  local: string | FileInfo | DirInfo
  remote: string
}

export type FileToCopy = {
  local: string | FileInfo | DirInfo
  remote: string
}

export const readDir = async (local: string) => await fs.promises.readdir(local, { withFileTypes: true })

export const normalizeFileInfo = async (local: string | FileInfo | DirInfo) => {
  const result = typeof local === 'string'
    ? { path: local, stats: await fs.promises.lstat(local) }
    : local

  if (result.stats.isSymbolicLink() && !result.symlinkTarget) {
    result.symlinkTarget = await fs.promises.readlink(result.path)
  }

  return result
}

export const normalizeDirInfo = async (local: string | DirInfo | FileInfo) => {
  const result: FileInfo = typeof local === 'string'
    ? await normalizeFileInfo(local)
    : local

  if (!('entries' in result)) {
    Object.assign(result, { entries: await readDir(result.path) })
  }

  return result as DirInfo
}

export const isDirEnt = (x: fs.Dirent | DirInfo): x is fs.Dirent => 'isDirectory' in x

const expandDir = async (local: string | DirInfo | FileInfo) => {
  const di = await normalizeDirInfo(local)
  const entries = await Promise.all(
    // eslint-disable-next-line no-use-before-define
    di.entries.map(e => expandFile(isDirEnt(e) ? path.posix.join(di.path, e.name) : e))
  )

  return {
    ...di,
    entries,
    size: sumArray(entries.map(e => e.size)),
    numFiles: sumArray(entries.map(e => e.numFiles)) + 1,
  }
}

export const expandFile = async (
  local: string | DirInfo | FileInfo,
): Promise<(FileInfo | DirInfo) & { size: number; numFiles: number }> => {
  const fi = await normalizeFileInfo(local)
  return fi.stats.isDirectory() ? await expandDir(fi)
    : { ...fi, size: fi.symlinkTarget ? 0 : fi.stats.size, numFiles: 1 }
}

export const pathFromStringOrFileInfo = (x: string | FileInfo | fs.Dirent) => {
  if (typeof x === 'string') { return x }
  if ('name' in x) { return x.name }
  return x.path
}
