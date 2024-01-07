import { mergeWith } from 'lodash-es'

export const mergeDeep = <TObject, TSource>(
  obj: TObject,
  ...src: TSource[]
) => mergeWith(
  obj,
  ...src,
  (a: unknown, b: unknown) => (
    Array.isArray(a) && Array.isArray(b) ? a.concat(b) : undefined
  )
) as TObject & TSource
