import { Args, Flags } from '@oclif/core'
import { createTunnelingKey } from '@preevy/core'
import {
  DriverName,
  extractConfigurableFlags,
  flagsForAllDrivers,
  machineCreationflagsForAllDrivers,
  machineDrivers,
} from '../../drivers'
import ProfileCommand from '../../profile-command'

// eslint-disable-next-line no-use-before-define
export default class CreateProfile extends ProfileCommand<typeof CreateProfile> {
  static description = 'Create a new profile'

  static flags = {
    ...flagsForAllDrivers,
    ...machineCreationflagsForAllDrivers,
    driver: Flags.custom<DriverName>({
      description: 'Machine driver to use',
      char: 'd',
      options: Object.keys(machineDrivers),
      required: true,
    })(),
  }

  static args = {
    name: Args.string({
      description: 'name of the new profile',
      required: true,
    }),
    url: Args.string({
      description: 'url of the new profile store',
      required: true,
    }),
  }

  static strict = false

  static enableJsonFlag = true

  async run(): Promise<unknown> {
    const alias = this.args.name
    const driver = this.flags.driver as DriverName
    const configurableFlags = extractConfigurableFlags(this.flags, driver)

    await this.profileConfig.create(alias, this.args.url, { driver }, async pStore => {
      await pStore.setDefaultFlags(driver, configurableFlags)
      this.log('Creating new SSH key pair')
      await pStore.setTunnelingKey(await createTunnelingKey())
    })
    return undefined
  }
}
