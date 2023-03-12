import fs from 'fs/promises'
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
      const transactionDir = path.join(
        tmpdir(),
        `transcation-${Math.random().toString(36).substring(7)}`
      )
      await fs.mkdir(transactionDir, { recursive: true })
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
          read: async (file: string) => fs.readFile(path.join(transactionDir, file)),
          list: async () => {
            const files = await fs.readdir(transactionDir)
            return files
          },
          write: async (file: string, content: string | Buffer) => {
            const target = path.join(transactionDir, file)
            try {
              await fs.writeFile(target, content)
            } catch (e) {
              if (isNotFoundError(e)) {
                await fs.mkdir(dirname(target), { recursive: true })
                await fs.writeFile(target, content)
                return
              }
              throw e
            }
          },
          delete: async (fileName: string) => {
            await fs.rm(path.join(transactionDir, fileName))
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
