export type PreviewEnv = {
  target: string
}

export type PreviewEnvStore = {
  get: (key: string) => Promise<PreviewEnv | undefined>
  set: (key: string, env: PreviewEnv) => Promise<void>
  delete: (key: string) => Promise<boolean>
}

export const inMemoryPreviewEnvStore = (initial?: Record<string, PreviewEnv>): PreviewEnvStore => {
  const map = new Map<string, PreviewEnv>(Object.entries(initial ?? {}))
  return {
    get: async (key) => map.get(key),
    set: async (key, value) => {
      map.set(key, value)
    },
    delete: async (key) => map.delete(key),
  }
}
