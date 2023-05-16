import { Hook as OclifHook } from '@oclif/core'
import { initHook } from '@preevy/cli-common'

const wrappedHook: OclifHook<'init'> = async function wrappedHook(...args) {
  try {
    await initHook.call(this, ...args)
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('init hook error', e)
    process.exit(1)
  }
}

export default wrappedHook
