import { VirtualFS } from './base'

export const jsonReader = (reader: Pick<VirtualFS, 'read'>) => {
  const readOrThrow = async (file: string): Promise<Buffer> => {
    const data = await reader.read(file)
    if (!data) {
      throw new Error(`missing file: ${file}`)
    }
    return data
  }

  return {
    async readJSON<T>(file:string) {
      const data = await reader.read(file)
      if (!data) return undefined
      return JSON.parse(data.toString()) as T
    },
    async readJsonOrThrow<T>(file: string) {
      const data = await readOrThrow(file)
      return JSON.parse(data.toString()) as T
    },
  }
}
