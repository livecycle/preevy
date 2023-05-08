import fs from 'fs'

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
