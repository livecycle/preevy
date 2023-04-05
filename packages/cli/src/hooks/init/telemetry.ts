import { Hook } from '@oclif/core'
import { newTelemetryEmitter, registerEmitter, wireProcessExit } from '../../lib/telemetry'

const hook: Hook<'init'> = async ({ config }) => {
  const disableTelemetry = ['1', 'true'].includes((config.scopedEnvVar('DISABLE_TELEMETRY') ?? '').toLowerCase())

  if (disableTelemetry) {
    return
  }

  const emitter = await newTelemetryEmitter(config)
  registerEmitter(emitter)
  wireProcessExit(process, emitter)
}

export default hook
