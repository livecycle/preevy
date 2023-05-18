import { Hook } from '@oclif/core'
import { telemetryEmitter } from '@preevy/core'

const hook: Hook.Prerun = async ({ Command: command, argv }) => {
  telemetryEmitter().capture('run', {
    command: command.name,
    argv,
  })
}

export default hook
