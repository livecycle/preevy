import { TelemetryEmitter } from './emitter'

export const wireProcessExit = (process: NodeJS.Process, emitter: TelemetryEmitter) => {
  const captureExit = (() => {
    let exitCaptured = false
    return async (event: string, code?: number): Promise<void> => {
      if (!exitCaptured) {
        emitter.capture('exit', { event, code })
        exitCaptured = true
      }
      return await emitter.flush()
    }
  })();

  ['SIGINT', 'SIGTERM'].forEach(signal => process.once(signal, async () => {
    await captureExit(signal)
    // re-trigger the signal after the current handler is unregistered, to restore the original behavior
    setImmediate(() => process.kill(process.pid, signal))
  }));

  (['exit', 'beforeExit'] as const).forEach(event => process.once(event, code => captureExit(event, code)))

  process.once('uncaughtException', (error, origin) => {
    emitter.capture('uncaughtException', { error, origin })
    return emitter.flush()
  })

  process.once('unhandledRejection', (reason, promise) => {
    emitter.capture('uncaughtException', { reason, promise })
    return emitter.flush()
  })
}
