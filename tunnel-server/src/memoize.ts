export const memoizeForDuration = <T>(f: () => T, milliseconds: number) => {
  let cache: { value: T; expiry: number } | undefined
  return () => {
    if (!cache || cache.expiry <= Date.now()) {
      cache = { value: f(), expiry: Date.now() + milliseconds }
    }
    return cache.value
  }
}
