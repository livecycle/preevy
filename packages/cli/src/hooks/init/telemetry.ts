import { Hook } from '@oclif/core'
import { createTelemetryEmitter, registerEmitter, wireProcessExit } from '@preevy/core'

const hook: Hook<'init'> = async ({ config }) => {
  const disableTelemetry = config.scopedEnvVarTrue('DISABLE_TELEMETRY')

  if (disableTelemetry) {
    return
  }

  const emitter = await createTelemetryEmitter(config)
  registerEmitter(emitter)
  wireProcessExit(process, emitter)
}

export default hook
