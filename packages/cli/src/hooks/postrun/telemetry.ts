import { Hook } from '@oclif/core'
import { telemetryEmitter } from '@preevy/core'

const hook: Hook.Postrun = async ({ config }) => {
  const disableTelemetry = config.scopedEnvVarTrue('DISABLE_TELEMETRY')

  if (disableTelemetry) {
    return
  }

  telemetryEmitter().cancel()
}

export default hook
