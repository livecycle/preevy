import { FsReader } from './base'

export const jsonReader = (reader: FsReader) => ({
  async readJSON<T>(file: string) {
    const data = await reader.read(file)
    return data === undefined ? undefined : JSON.parse(data.toString()) as T
  },
  async readJsonOrThrow<T>(file: string) {
    const data = await reader.read(file)
    if (data === undefined) {
      throw new Error(`missing file: ${file}`)
    }
    return JSON.parse(data.toString()) as T
  },
})
