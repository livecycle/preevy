import ah from 'async_hooks'
import { Hook } from '@oclif/core'

const hook: Hook<'init'> = async () => {
  const traces = new Map()

  const originalCaptureStackTrace = global.Error.captureStackTrace

  const captureStackTrace = (what: { stack: string }, where: (...args: unknown[]) => unknown) => {
    originalCaptureStackTrace.call(global.Error, what, where)
    const trace = traces.get(ah.executionAsyncId())
    if (trace) what.stack += trace
  }

  ah.createHook({
    init(id: number) {
      const trace = {}
      Error.captureStackTrace(trace)
      traces.set(id, (trace as { stack: string }).stack.replace(/(^.+$\n){6}/m, '\n'))
    },
    destroy(id) {
      traces.delete(id)
    },
  }).enable()

  global.Error.captureStackTrace = captureStackTrace
}

export default hook
