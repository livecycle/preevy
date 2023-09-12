import events from 'events'
import { TimeoutError } from 'p-timeout'

interface NodeEventTarget {
  once(eventName: string | symbol, listener: (...args: unknown[]) => void): this
}

export async function onceWithTimeout(
  target: NodeEventTarget,
  event: string | symbol,
  opts: { milliseconds: number },
): Promise<void>
export async function onceWithTimeout <T = unknown>(
  target: NodeEventTarget,
  event: string | symbol,
  opts: { milliseconds: number; fallback: () => T | Promise<T> },
): Promise<T>
export async function onceWithTimeout <T = unknown>(
  target: NodeEventTarget,
  event: string | symbol,
  { milliseconds, fallback }: { milliseconds: number; fallback?: () => T | Promise<T> },
): Promise<T | void> {
  const signal = AbortSignal.timeout(milliseconds)
  return await events.once(target, event, { signal }).then(
    () => undefined,
    async e => {
      if (!signal.aborted || (e as Error).name !== 'AbortError') {
        throw e
      }
      if (fallback) {
        return await fallback()
      }
      throw new TimeoutError(`timed out after ${milliseconds}ms`)
    },
  )
}
