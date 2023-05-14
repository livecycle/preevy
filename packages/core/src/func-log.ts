import { isPromise } from 'util/types'
import { LogFunc } from './log'

export const logFunc = <Args extends unknown[], Return>(
  f: (...args: Args) => Return,
  opts: {
    log?: LogFunc
    name?: string
  } = {}
) => (...args: Args): Return => {
    // eslint-disable-next-line no-console
    const logger = opts?.log || console.log
    const name = opts?.name || f.name

    const log = (
      details: { result: Return } | { exception: unknown }
    ) => logger(`function call: ${name}`, { args, ...details })

    try {
      const r = f(...args)
      if (isPromise(r)) {
        return r.then(
          r2 => {
            log({ result: r2 as Return })
            return r2
          },
          e => {
            log({ exception: e })
            throw e
          }
        ) as Return
      }
      log({ result: r })
      return r
    } catch (e) {
      log({ exception: e })
      throw e
    }
  }
