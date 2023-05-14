import { Hook } from '@oclif/core'
import { newTelemetryEmitter, registerEmitter, wireProcessExit } from '@preevy/core'

const hook: Hook<'init'> = async ({ config }) => {
  const disableTelemetry = config.scopedEnvVarTrue('DISABLE_TELEMETRY')

  if (disableTelemetry) {
    return
  }

  const emitter = await newTelemetryEmitter(config)
  registerEmitter(emitter)
  wireProcessExit(process, emitter)
}

export default hook
