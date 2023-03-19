import { Args, ux } from '@oclif/core'
import DriverCommand from '../../driver-command'

// eslint-disable-next-line no-use-before-define
export default class UseProfile extends DriverCommand<typeof UseProfile> {
  static description = 'Set current profile'

  static args = {
    name: Args.string({
      description: 'name of the profile to use',
      required: true,
    }),
  }

  static strict = false

  static enableJsonFlag = true

  async run(): Promise<unknown> {
    const alias = this.args.name
    await this.profileConfig.setCurrent(alias)
    ux.info(`Profile ${alias} is now being used`)
    return undefined
  }
}
