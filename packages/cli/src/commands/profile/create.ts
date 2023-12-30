import { Args, Flags, ux } from '@oclif/core'
import { createTunnelingKey } from '@preevy/core'
import { text } from '@preevy/cli-common'
import {
  DriverName,
  extractDriverFlags,
  flagsForAllDrivers,
  machineCreationflagsForAllDrivers,
} from '../../drivers.js'
import ProfileCommand from '../../profile-command.js'
import DriverCommand from '../../driver-command.js'

// eslint-disable-next-line no-use-before-define
export default class CreateProfile extends ProfileCommand<typeof CreateProfile> {
  static description = 'Create a new profile'

  static flags = {
    ...flagsForAllDrivers,
    ...machineCreationflagsForAllDrivers,
    driver: DriverCommand.baseFlags.driver,
    use: Flags.boolean({
      description: 'Mark the new profile as the current profile',
      required: false,
    }),
  }

  static args = {
    name: Args.string({
      description: 'Name of the new profile',
      required: true,
    }),
    url: Args.string({
      description: 'URL of the new profile',
      required: true,
    }),
  }

  static strict = false

  static enableJsonFlag = true

  async run(): Promise<unknown> {
    const alias = this.args.name
    const driver = this.flags.driver as DriverName | undefined

    await this.profileConfig.create(alias, this.args.url, { driver }, async op => {
      if (driver) {
        await op.defaultDriverFlags(driver).write(extractDriverFlags(this.flags, driver))
      }
      this.log('Creating new SSH key pair')
      await op.tunnelingKey().write(await createTunnelingKey())
    }, this.flags.use)

    ux.info(text.success('Profile initialized 👍'))

    return undefined
  }
}
