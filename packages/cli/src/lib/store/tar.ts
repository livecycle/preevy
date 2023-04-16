import { tmpdir } from 'os'
import path from 'path'
import { rimraf } from 'rimraf'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import { mkdtemp } from 'fs/promises'
import tar from 'tar'
import { SnapshotFromBuffer } from './snapshot'
import { localFs } from './fs'

const readStream = (stream: Readable): Promise<Buffer> => new Promise<Buffer>((resolve, reject) => {
  const buffer: Buffer[] = []
  stream.on('data', chunk => buffer.push(chunk))
  stream.on('end', () => resolve(Buffer.concat(buffer)))
  stream.on('error', reject)
})

export const tarSnapshot: SnapshotFromBuffer = async existingTar => {
  const transactionDir = await mkdtemp(path.join(tmpdir(), 'preevy-transactions-'))

  if (existingTar) {
    await pipeline(
      Readable.from(existingTar),
      tar.x({
        cwd: transactionDir,
      })
    )
  }

  return Object.assign(localFs(transactionDir), {
    close: async () => {
      await rimraf(transactionDir)
    },
    save: async () => readStream(
      tar.c(
        {
          cwd: transactionDir,
          prefix: '',
        },
        ['.']
      )
    ),
  })
}
