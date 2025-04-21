import { Hook as OclifHook } from '@oclif/core'
import { errorToJson, initHook } from '@preevy/cli-common'
import { telemetryEmitter } from '@preevy/core'

const wrappedHook: OclifHook<'init'> = async function wrappedHook(...args) {
  try {
    await initHook.call(this, ...args)
  } catch (e) {

    console.error(`init plugin failed: ${(e as Error).stack || e}`)
    telemetryEmitter().capture('plugin-init-error', { error: errorToJson(e) })
    await telemetryEmitter().flush()
    process.exit(1)
  }
}

export default wrappedHook
