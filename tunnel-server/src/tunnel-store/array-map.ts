export type MultiMap<K, V> = {
  get: (key: K) => readonly V[] | undefined
  add: (key: K, value: V) => void
  delete: (key: K, pred: (value: V) => boolean) => void
}

export const multimap = <K, V>(): MultiMap<K, V> => {
  const map = new Map<K, V[]>()
  return {
    get: (key: K) => map.get(key),
    add: (key: K, value: V) => {
      let ar = map.get(key)
      if (ar === undefined) {
        ar = []
        map.set(key, ar)
      }
      ar.push(value)
    },
    delete: (key: K, pred: (value: V) => boolean) => {
      let ar = map.get(key)
      if (ar === undefined) {
        return undefined
      }
      ar = ar.filter(value => !pred(value))
      if (ar.length === 0) {
        map.delete(key)
      } else {
        map.set(key, ar)
      }
      return undefined
    },
  }
}
