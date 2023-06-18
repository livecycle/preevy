import fs from 'fs'
import path from 'path'
import sqw from 'shell-quote-word'

type FilterStoreEntry = {
  size: number
  mtimeSecondsSinceEpoch: number
  symlinkTarget?: string
  isDir: boolean
}

export type FilterStore = Map<string, FilterStoreEntry>

const re = /^([0-9]+) ([0-9]+) ("([^"]+)") (.*)/

const parseFindResultLine = (line: string): [string, FilterStoreEntry] => {
  const match = re.exec(line)
  if (!match) {
    throw new Error(`Invalid line: ${line}`)
  }

  const [, size, mtimeSecondsSinceEpoch,, ftype, qname] = match
  const [filename,, symlinkTarget] = sqw(qname)

  return [
    path.normalize(filename),
    {
      size: Number(size),
      mtimeSecondsSinceEpoch: Number(mtimeSecondsSinceEpoch),
      symlinkTarget,
      isDir: ftype === 'directory',
    },
  ]
}

const parseFindResult = (findResult: string | Buffer) => {
  const result = Buffer.isBuffer(findResult) ? findResult.toString('utf8') : findResult
  const lines = result.split('\n')
  return new Map<string, FilterStoreEntry>(lines.map(parseFindResultLine))
}

export const filterCommand = 'sudo find . -print0 | sudo xargs -r0 stat -c \'%s %Y "%F" %N\''

const equals = (
  { stats: s, symlinkTarget }: { stats: fs.Stats; symlinkTarget?: string },
  e: FilterStoreEntry,
) => {
  const sIsDir = s.isDirectory()

  if (e.isDir) {
    return sIsDir
  }

  if (sIsDir) {
    return false
  }

  if (e.mtimeSecondsSinceEpoch !== Math.floor(s.mtimeMs / 1000)) {
    return false
  }

  if (e.symlinkTarget) {
    return symlinkTarget === e.symlinkTarget
  }

  if (e.size !== s.size) {
    return false
  }

  return true
}

export const filterStore = (from: string | Buffer | Map<string, FilterStoreEntry>) => {
  const map = typeof from === 'string' || Buffer.isBuffer(from)
    ? parseFindResult(from)
    : from

  return {
    has: (
      fi: { stats: fs.Stats; symlinkTarget?: string },
      name: string,
    ): boolean => {
      const e = map.get(name)
      return e !== undefined && equals(fi, e)
    },
  }
}
