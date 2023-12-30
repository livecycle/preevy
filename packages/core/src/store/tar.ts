import { tmpdir } from 'os'
import path from 'path'
import { rimraf } from 'rimraf'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import { mkdtemp } from 'fs/promises'
import tar from 'tar'
import { localFs } from './fs/index.js'
import { FileBackedSnapshotter, Snapshot } from './snapshot.js'

const readStream = (stream: Readable): Promise<Buffer> => new Promise<Buffer>((resolve, reject) => {
  const buffer: Buffer[] = []
  stream.on('data', chunk => buffer.push(chunk))
  stream.on('end', () => resolve(Buffer.concat(buffer)))
  stream.on('error', reject)
})

export const tarSnapshot: FileBackedSnapshotter = async (fs, filename): Promise<Snapshot> => {
  const transactionDir = await mkdtemp(path.join(tmpdir(), 'preevy-transactions-'))
  const existingTar = await fs.read(filename)

  if (existingTar) {
    await pipeline(
      Readable.from(existingTar),
      tar.x({
        cwd: transactionDir,
      })
    )
  }

  let dirty = false
  const setDirty = <Args extends unknown[], Return>(
    f: (...args: Args) => Return,
  ) => (...args: Args) => { dirty = true; return f(...args) }

  const save = async () => await fs.write(filename, await readStream(
    tar.c(
      {
        cwd: transactionDir,
        prefix: '',
      },
      ['.']
    )
  ))

  const local = localFs(transactionDir)

  return {
    read: local.read,
    write: setDirty(local.write),
    delete: setDirty(local.delete),
    save: async () => {
      if (dirty) {
        await save()
      }
    },
    [Symbol.asyncDispose]: async () => {
      await rimraf(transactionDir)
    },
  }
}
