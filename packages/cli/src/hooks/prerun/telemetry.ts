import { Hook } from '@oclif/core'
import { telemetryEmitter } from '../../lib/telemetry'

const hook: Hook<'prerun'> = async ({ Command: command, argv }) => {
  telemetryEmitter().capture('prerun', {
    command: command.name,
    argv,
  })
}

export default hook
