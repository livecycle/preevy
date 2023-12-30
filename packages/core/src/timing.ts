export const measureTime = async <T>(f: () => Promise<T>) => {
  const startTime = Date.now()
  const result = await f()
  const elapsedTimeSec = (new Date().getTime() - startTime) / 1000
  return { result, elapsedTimeSec }
}
