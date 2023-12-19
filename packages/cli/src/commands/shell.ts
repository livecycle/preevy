import { Args } from '@oclif/core'
import { commands } from '@preevy/core'
import DriverCommand from '../driver-command.js'

// eslint-disable-next-line no-use-before-define
export default class Shell extends DriverCommand<typeof Shell> {
  static description = 'Execute a command or start an interactive shell inside an environment'
  static aliases = ['ssh']

  static hidden = true
  static strict = false

  static flags = {
  }

  static args = {
    envId: Args.string({ description: 'Environment id', required: true }),
  }

  static enableJsonFlag = false

  async run(): Promise<unknown> {
    const { args, rawArgs } = this
    const driver = await this.driver()

    const result = await commands.shell({
      envId: args.envId,
      args: rawArgs.slice(1),
      machineDriver: driver,
      log: this.logger,
    })

    if ('code' in result) {
      this.exit(result.code)
    } else {
      process.kill(process.pid, result.signal)
    }

    return undefined
  }
}
