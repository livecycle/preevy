import { Args } from '@oclif/core'
import { Flag } from '@oclif/core/lib/interfaces'
import { createTunnelingKey } from '@preevy/core'
import {
  DriverName,
  excludeDefaultFlags,
  flagsForAllDrivers,
  machineCreationflagsForAllDrivers,
  machineDrivers,
} from '../../drivers'
import DriverCommand from '../../driver-command'

// eslint-disable-next-line no-use-before-define
export default class CreateProfile extends DriverCommand<typeof CreateProfile> {
  static description = 'Create a new profile'

  static flags = {
    ...flagsForAllDrivers,
    ...machineCreationflagsForAllDrivers,
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
    const driverStatic = machineDrivers[driver]
    const allDriverFlags = {
      ...driverStatic.flags,
      ...driverStatic.machineCreationFlags,
    }

    const driverPrefix = `${driver}-`
    const defaultFlagsFilter = excludeDefaultFlags(allDriverFlags as Record<string, Flag<unknown>>)

    const driverFlags = Object.entries(this.flags)
      .filter(([k]) => k.startsWith(driverPrefix))
      .map(([k, v]) => [k.substring(driverPrefix.length), v])
      .filter(([k, v]) => defaultFlagsFilter([k as string, v]))

    await this.profileConfig.create(alias, this.args.url, { driver }, async pStore => {
      await pStore.setDefaultFlags(driver, driverFlags)
      this.log('Creating new SSH key pair')
      await pStore.setTunnelingKey(await createTunnelingKey())
    })
    return undefined
  }
}
