import fs from 'fs'

export const undefinedOnNoEntError = <T>(p: Promise<T>) => p.catch(err => {
  if ((err as { code: unknown }).code === 'ENOENT') {
    return undefined
  }
  throw err
})

export const lstatOrUndefined = (
  file: string,
): Promise<fs.Stats | undefined> => undefinedOnNoEntError(fs.promises.lstat(file))
