import { Args } from '@oclif/core'
import DriverCommand from '../../driver-command'
import { ssh } from '../../lib/commands'
import { fsState } from '../../lib/state'
import { realFs } from '../../lib/state/fs'

export default class Ssh extends DriverCommand<typeof Ssh> {
  static description = 'SSH into a preview environment machine'

  static hidden = true
  static strict = false

  static flags = {
  }

  static args = {
    envId: Args.string({ description: 'Environment id', required: true }),
  }

  static enableJsonFlag = false

  async run(): Promise<unknown> {
    const { args, raw } = await this.parse(Ssh)

    const state = fsState(realFs(this.config.dataDir))

    const restArgs = raw.filter(arg => arg.type === 'arg').slice(1).map(arg => arg.input)

    const { code } = await ssh({
      envId: args.envId,
      dataDir: this.config.dataDir,
      args: restArgs,
      machineDriver: this.machineDriver,
      log: this.logger,
      state,
    })

    this.exit(code ?? 0)

    return undefined
  }
}
