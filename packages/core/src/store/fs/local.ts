import fs from 'fs/promises'
import path, { dirname } from 'path'
import { rimraf } from 'rimraf'
import { VirtualFS } from './base'

const isNotFoundError = (e: unknown) => (e as { code?: unknown })?.code === 'ENOENT'

export const localFs = (baseDir: string): VirtualFS => ({
  read: async (filename: string) => {
    const filepath = path.join(baseDir, filename)
    try {
      return await fs.readFile(filepath)
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
        return await fs.mkdir(dirname(filepath), { recursive: true }).then(f)
      }
      throw e
    }
  },
  delete: async (filename: string) => {
    await rimraf(filename)
  },
})

export const localFsFromUrl = (
  baseDir: string,
  url: string,
): VirtualFS => localFs(path.join(baseDir, new URL(url).hostname))
