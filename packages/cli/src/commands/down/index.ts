import { Args, Flags } from '@oclif/core'
import DriverCommand from '../../driver-command'
import { down } from '../../lib/commands'
import { fsState } from '../../lib/state'
import { realFs } from '../../lib/state/fs'

export default class Down extends DriverCommand<typeof Down> {
  static description = 'Delete preview environments'

  static flags = {
    force: Flags.boolean({
      description: 'Do not error if the environment is not found',
      char: 'f',
      default: false,
    }),
  }

  static args = {
    id: Args.string({ 
      description: 'Environment IDs to delete', 
      required: true,
      multiple: true,
    }),
  }

  static strict = false

  static enableJsonFlag = true

  async run(): Promise<unknown> {
    const {args, flags, raw} = await this.parse(Down)

    const envIds = raw.filter(({ type }) => type === 'arg').map(({ input }) => input)

    const state = fsState(realFs(this.config.dataDir))

    const result = (
      await down({ 
        machineDriver: this.machineDriver, 
        state, 
        log: this.logger, 
        envIds, 
        throwOnNotFound: !flags.force,
      })
    ).map(({ envId }) => envId)

    if (flags.json) {
      return result
    }

    result.forEach(envId => this.log(envId))
  }
}
