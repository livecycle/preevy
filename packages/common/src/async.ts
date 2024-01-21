export type AsyncObjectIterator<TObject, TResult> = (
  value: TObject[keyof TObject],
  key: string,
  collection: TObject,
) => Promise<TResult>

export const asyncMapValues = async <T extends object, TResult>(
  obj: T,
  callback: AsyncObjectIterator<T, TResult>,
): Promise<{ [P in keyof T]: TResult }> => Object.fromEntries(
  await Promise.all(
    Object.entries(obj).map(async ([key, value]) => [key, await callback(value, key, obj)])
  )
)

export function timeoutPromise(ms: number): Promise<void>
export function timeoutPromise<T>(ms: number, value: T): Promise<T>
export function timeoutPromise<T>(ms: number, value?: T) {
  return new Promise(resolve => { setTimeout(() => resolve(value), ms) })
}

export function withTimeout<Val, TimeoutVal = Val>(p: PromiseLike<Val>, ms: number, timeoutValue?: TimeoutVal) {
  return Promise.race([
    p,
    timeoutPromise(ms, timeoutValue),
  ])
}
