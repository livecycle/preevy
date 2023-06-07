import { Hook } from '@oclif/core'
// eslint-disable-next-line import/no-extraneous-dependencies
import { telemetryEmitter } from '@preevy/core'

const hook: Hook.Postrun = async ({ Command: command, argv }) => {
  telemetryEmitter().capture('postrun', {
    command: command.name,
    argv,
  })
  void telemetryEmitter().unref()
}

export default hook
