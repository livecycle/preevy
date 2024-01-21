import { inspect } from 'util'
import { main } from './src/main.js'

const exitSignals = ['SIGTERM', 'SIGINT', 'uncaughtException'] as const
const SHUTDOWN_TIMEOUT = 5000

void main(process).then(({ log, [Symbol.asyncDispose]: dispose }) => {
  exitSignals.forEach(signal => {
    process.once(signal, async (...args) => {
      const isError = signal === 'uncaughtException'
      const logLevel = isError ? 'error' : 'warn'
      const argsStr = args.map(arg => inspect(arg)).join(', ')
      log[logLevel](`shutting down on ${[signal, argsStr].filter(Boolean).join(': ')}`)
      if (!await Promise.race([
        dispose().then(() => true),
        new Promise<void>(resolve => { setTimeout(resolve, SHUTDOWN_TIMEOUT) }),
      ])) {
        log.error(`timed out while waiting ${SHUTDOWN_TIMEOUT}ms for server to close, exiting`)
      }
      process.exit(isError ? 1 : 0)
    })
  })
})
