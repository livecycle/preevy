export const pSeries = async <T>(funcs: (() => Promise<T>)[]) => {
  const result: T[] = []
  for (const func of funcs) {

    result.push(await func())
  }
  return result
}
