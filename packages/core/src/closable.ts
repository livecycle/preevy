import { isPromise } from 'util/types'

export type Closable = { close: () => void | Promise<void> }
export const withClosable = async <Args extends unknown[], C extends Closable, Return>(
  f: (closable: C, ...args: Args) => Return,
  closable: C,
  ...args: Args
) => {
  try {
    const result = f(closable, ...args)
    return isPromise(result)
      ? await result
      : result
  } finally {
    await closable.close()
  }
}
