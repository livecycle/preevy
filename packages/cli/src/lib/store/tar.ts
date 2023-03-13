import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import path, { dirname } from 'path'
import { rimraf } from 'rimraf'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import tar from 'tar'
import { Snapshotter } from './types'

const isNotFoundError = (e: unknown) =>
  (e as { code?: unknown })?.code === 'ENOENT'

async function readStream(stream: Readable): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const buffer:Buffer[] = []
    stream.on('data', chunk => buffer.push(chunk))
    stream.on('end', () => resolve(Buffer.concat(buffer)))
    stream.on('error', err => reject(new Error(`error converting stream - ${err}`)))
  })
}

export function tarSnapshotter(): Snapshotter {
  return {
    open: async (existingSnapshot: Buffer | undefined) => {
      const transactionDir = await mkdtemp(path.join(tmpdir(), 'preview-transactions-'))
      if (existingSnapshot) {
        await pipeline(
          Readable.from(existingSnapshot),
          tar.x({
            cwd: transactionDir,
          })
        )
      }
      return {
        snapshot: {
          read: async (file: string) => {
            try {
              return await readFile(path.join(transactionDir, file))
            } catch (error) {
              if (isNotFoundError(error)) {
                return undefined
              }
              throw error
            }
            return undefined
          },
          list: async () => {
            const files = await readdir(transactionDir)
            return files
          },
          write: async (file: string, content: string | Buffer) => {
            const target = path.join(transactionDir, file)
            try {
              await writeFile(target, content)
            } catch (e) {
              if (isNotFoundError(e)) {
                await mkdir(dirname(target), { recursive: true })
                await writeFile(target, content)
                return
              }
              throw e
            }
          },
          delete: async (fileName: string) => {
            await rm(path.join(transactionDir, fileName))
          },
        },
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
      }
    },
  }
}
