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
