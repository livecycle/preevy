import { Hook } from '@oclif/core'
import { telemetryEmitter } from '@preevy/core'

const hook: Hook<'prerun'> = async ({ Command: command, argv }) => {
  telemetryEmitter().capture('run', {
    command: command.name,
    argv,
  })
}

export default hook
