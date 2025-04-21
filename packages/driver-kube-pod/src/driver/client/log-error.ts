import { HttpError } from '@kubernetes/client-node'
import { Logger } from '@preevy/core'
import { inspect } from 'util'

export const logError = (log: Logger) => <
  Args extends unknown[],
  ReturnType
>(
  f: (...args: Args) => Promise<ReturnType>
) => async (...args: Args): Promise<ReturnType> => {
  try {
    return await f(...args)
  } catch (e) {
    if (e instanceof HttpError) {
      log.error(`Response: ${inspect(e.body)}`)
    }
    throw e
  }
}

export type FuncWrapper = <
  Args extends unknown[],
  ReturnType
>(f: (...args: Args) => Promise<ReturnType>) => (...args: Args) => Promise<ReturnType>
