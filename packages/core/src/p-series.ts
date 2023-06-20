export const pSeries = async <T>(funcs: (() => Promise<T>)[]) => {
  const result: T[] = []
  for (const func of funcs) {
    // eslint-disable-next-line no-await-in-loop
    result.push(await func())
  }
  return result
}
