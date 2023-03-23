/* eslint-disable @typescript-eslint/no-explicit-any */
import originalPLimit from 'p-limit'

type LimitFunc<Arguments extends any[], ReturnType> = (
  fn: (...args: Arguments) => PromiseLike<ReturnType> | ReturnType,
  ...args: Arguments
) => Promise<ReturnType>

const noLimit = async <Arguments extends any[], ReturnType>(
  fn: (...args: Arguments) => PromiseLike<ReturnType> | ReturnType,
  ...args: Arguments
) => fn(...args)

export const pLimit = <Arguments extends any[], ReturnType>(
  concurrency: number,
) => (concurrency > 0 ? originalPLimit(concurrency) as LimitFunc<Arguments, ReturnType> : noLimit)
