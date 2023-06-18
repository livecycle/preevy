import { Args } from '@oclif/core'
import { commands } from '@preevy/core'
import DriverCommand from '../driver-command'

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
    const { args, raw } = await this.parse(Shell)
    const driver = await this.driver()

    const restArgs = raw.filter(arg => arg.type === 'arg').slice(1).map(arg => arg.input)

    const { code } = await commands.shell({
      envId: args.envId,
      args: restArgs,
      machineDriver: driver,
      log: this.logger,
    })

    this.exit(code ?? 0)

    return undefined
  }
}
