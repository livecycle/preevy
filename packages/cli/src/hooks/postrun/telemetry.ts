import { Hook } from '@oclif/core'
import { telemetryEmitter } from '@preevy/core'

const hook: Hook.Postrun = async () => {
  void telemetryEmitter().flush()
}

export default hook
