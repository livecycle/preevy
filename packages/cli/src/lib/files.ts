import os from 'os'
import path from 'path'
import fs from 'fs'
import { rimrafSync } from 'rimraf'

export const undefinedOnNoEntError = <T>(p: Promise<T>) => p.catch(err => {
  if ((err as { code: unknown }).code === 'ENOENT') {
    return undefined
  }
  throw err
})

type Stat = typeof fs.promises.stat

export const statOrUndefined = (
  ...args: Parameters<Stat>
): Promise<Awaited<ReturnType<Stat>> | undefined> => undefinedOnNoEntError(
  fs.promises.stat(...args)
)

export const lazyTempDir = (name: string) => {
  let value: string
  const dispose = () => value && rimrafSync(value)
  return {
    get path() {
      if (!value) {
        value = fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`))
        process.on('exit', dispose)
      }
      return value
    },
    dispose,
  }
}

export type LazyTempDir = ReturnType<typeof lazyTempDir>
