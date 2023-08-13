import fs from 'fs'
import path from 'path'

const readDir = async (dir: string) => {
  try {
    return ((await fs.promises.readdir(dir, { withFileTypes: true })) ?? [])
      .filter(d => d.isFile()).map(f => f.name)
  } catch (e) {
    if ((e as { code: string }).code === 'ENOENT') {
      return []
    }
    throw e
  }
}

export const readAllFiles = async (dir: string) => {
  const files = await readDir(dir)
  return await Promise.all(
    files.map(file => fs.promises.readFile(path.join(dir, file), { encoding: 'utf8' }))
  )
}
