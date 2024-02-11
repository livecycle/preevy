import fs from 'fs'

const isNotFoundError = (e: unknown) => (e as { code?: unknown })?.code === 'ENOENT'
export const readFileSyncOrUndefined = (filename: string) => {
  try {
    return fs.readFileSync(filename, { encoding: 'utf8' })
  } catch (e) {
    if (isNotFoundError(e)) {
      return undefined
    }
    throw e
  }
}
