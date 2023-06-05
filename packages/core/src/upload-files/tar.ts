import util from 'util'
import path from 'path'
import fs from 'fs'
import { pack, Headers, Pack } from 'tar-stream'
import { Writable, pipeline } from 'stream'
import { TransferProgressEmitter, transferProgressEmitter } from './progress'
import { FileInfo, FileToCopy } from './files'
import { Visitor, fsWalker } from './walk'

const headerFromStats = (local: FileInfo, remote: string): Headers | undefined => {
  const { stats, symlinkTarget } = local
  const header: Headers = {
    name: remote,
    mode: stats.mode,
    mtime: stats.mtime,
    size: stats.size,
    uid: stats.uid,
    gid: stats.gid,
    type: 'file',
  }

  if (stats.isDirectory()) {
    header.type = 'directory'
  } else if (stats.isSymbolicLink()) {
    header.type = 'symlink'
    header.linkname = symlinkTarget
    header.size = 0
  } else if (stats.isFIFO()) {
    header.type = 'fifo'
  } else if (stats.isSocket()) {
    return undefined
  }

  return header
}

const addEntry = (
  p: Pack,
  emitter: TransferProgressEmitter,
  header: Headers,
  filePath: string,
) => new Promise<void>((resolve, reject) => {
  const stream = p.entry(header, err => {
    if (err) {
      p.destroy(err)
      reject(err)
      return
    }
    resolve()
  })

  if (!stream) {
    process.stderr.write(`no stream: ${filePath}, ${util.inspect(stream)}, ${util.inspect(p)} ${util.inspect(header)}\n`)
    resolve()
    return
  }

  if (header.type === 'file') {
    emitter.emit('file', filePath)

    const rs = fs.createReadStream(filePath)
    rs.on('data', chunk => { emitter.emit('bytes', { bytes: chunk.length, file: filePath }) })
    pipeline(rs, stream, err => {
      if (err) {
        p.destroy(err)
        reject(err)
      }
    })
  }
})

const chainPromise = () => {
  let pr = Promise.resolve()
  return {
    chain: (f: () => Promise<void>) => { pr = pr.then(f) },
    promise: () => pr,
  }
}

export const tarStream = (filesToCopy: FileToCopy[] = []) => {
  const add = (fileToCopy: FileToCopy) => { filesToCopy.push(fileToCopy) }

  const finalize = ({ out, concurrency, filter = (_f, r) => r }: {
    out: Writable
    concurrency: number
    filter?: (fi: FileInfo, remote: string) => string | undefined
  }) => {
    const p = pack()
    const done = new Promise<void>((resolve, reject) => {
      // make sure p is piped into another stream BEFORE any entries are added, otherwise the stream hangs
      pipeline(p, out, err => {
        if (err) {
          reject(err)
          return
        }
        resolve()
      })
    })

    const emitter = transferProgressEmitter()

    const entriesPromise = chainPromise()
    const totals = { files: 0, bytes: 0 }
    const visitor: Visitor<FileToCopy> = {
      visit: (fileToCopy, fi) => {
        const filterResult = filter(fi, fileToCopy.remote)
        if (!filterResult) {
          return
        }
        const header = headerFromStats(fi, filterResult)
        if (!header) {
          return
        }
        if (header.type === 'file') {
          totals.files += 1
          totals.bytes += header.size ?? 0
        }
        entriesPromise.chain(() => addEntry(p, emitter, header, fi.path))
      },
      directoryEntry: (file: FileToCopy, entry: string) => ({
        local: path.join(file.local, entry),
        remote: path.join(file.remote, entry),
      }),
    }

    const walkPromise = fsWalker(concurrency, visitor, filesToCopy)

    void walkPromise.then(() => {
      // must wait until all entries are added before calling p.finalize
      entriesPromise.chain(async () => { p.finalize() })
    })

    return { done, emitter, totals: walkPromise.then(() => totals) }
  }

  return { add, finalize }
}

export type FinalizeResult = Awaited<ReturnType<ReturnType<typeof tarStream>['finalize']>>
