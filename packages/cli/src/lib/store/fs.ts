import fs from 'fs/promises'
import path, { dirname } from 'path'
import { rimraf } from 'rimraf'
import { VirtualFS } from './types'

const isNotFoundError = (e: unknown) => (e as { code?: unknown })?.code === 'ENOENT'

export const realFs = (baseDir: string): VirtualFS => ({
  read: async (filename: string) => {
    const filepath = path.join(baseDir, filename)
    const f = () => fs.readFile(filepath)
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
    const f = () => fs.writeFile(filepath, content)
    try {
      return await f()
    } catch (e) {
      if (isNotFoundError(e)) {
        return fs.mkdir(dirname(filepath), { recursive: true }).then(f)
      }
      throw e
    }
  },
  delete: (filename: string) => rimraf(filename),
})
