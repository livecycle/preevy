import fs from 'fs'
import path, { dirname } from 'path'
import { rimraf } from 'rimraf'

export type SimpleFS = {
  read: (filename: string) => Promise<Buffer | undefined>
  write: (filename: string, content: Buffer | string) => Promise<void>
  delete: (filename: string) => Promise<void>
  flush: () => Promise<void>
}

const isNotFoundError = (e: unknown) => (e as { code?: unknown })?.code === 'ENOENT'

export const realFs = (baseDir: string): SimpleFS => ({
  read: async (filename: string) => {
    const filepath = path.join(baseDir, filename)
    const f = () => fs.promises.readFile(filepath)
    try {
      return await f()
    } catch (e) {
      if (isNotFoundError(e)) {
        return undefined
      }
      throw e
    }
  },
  write: async (filename: string, content: Buffer | string) => {
    const filepath = path.join(baseDir, filename)
    const f = () => fs.promises.writeFile(filepath, content)
    try {
      return await f()
    } catch (e) {
      if (isNotFoundError(e)) {
        return fs.promises.mkdir(dirname(filepath), { recursive: true }).then(f)
      }
      throw e
    }
  },
  delete: async (filename: string) => { await rimraf(filename) },
  flush: async () => undefined,
})
