import { Hook as OclifHook } from '@oclif/core'
import { initHook } from '@preevy/cli-common'
import { telemetryEmitter } from '@preevy/core'

const wrappedHook: OclifHook<'init'> = async function wrappedHook(...args) {
  try {
    const { id } = args[0]
    if (id === 'help' || id === 'version' || id === 'init') {
      return
    }
    await initHook.call(this, ...args)
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(`warning: failed to init plugins: ${e}`)
    telemetryEmitter().capture('plugin-init-error', { error: `${e}` })
  }
}

export default wrappedHook
