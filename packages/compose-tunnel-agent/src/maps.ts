export const intersection = <K, V>(m1: Map<K, V>, m2: Map<K, V>) => new Map<K, V>(
  [...m1.entries()].filter(([key]) => m2.has(key))
)

export const difference = <K, V1, V2>(m1: Map<K, V1>, m2: Map<K, V2>) => new Map<K, V1>(
  [...m1.entries()].filter(([key]) => !m2.has(key))
)
