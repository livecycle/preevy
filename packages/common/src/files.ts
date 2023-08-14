import fs from 'node:fs'

export const isNotFoundError = (e: unknown) => (e as { code?: unknown })?.code === 'ENOENT'

export const readOrUndefined = (
  ...args: Parameters<typeof fs.promises.readFile>
) => fs.promises.readFile(...args).catch(err => {
  if (isNotFoundError(err)) {
    return undefined
  }
  throw err
})
