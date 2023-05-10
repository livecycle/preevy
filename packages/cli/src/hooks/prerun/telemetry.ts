import { Hook } from '@oclif/core'
import { telemetryEmitter } from '@preevy/cli-core/src/lib/telemetry'

const hook: Hook<'prerun'> = async ({ Command: command, argv }) => {
  telemetryEmitter().capture('run', {
    command: command.name,
    argv,
  })
}

export default hook
