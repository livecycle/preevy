export const intersection = <K>(a: Pick<Set<K>, 'keys'>, b: Pick<Set<K>, 'has'>) => new Set<K>(
  [...a.keys()].filter(key => b.has(key))
)

export const difference = <K>(a: Pick<Set<K>, 'keys'>, b: Pick<Set<K>, 'has'>) => new Set<K>(
  [...a.keys()].filter(key => !b.has(key))
)
