import { Args } from '@oclif/core'
import { mapKeys, pickBy } from 'lodash'
import { ensureTunnelKeyPair } from '@preevy/core'
import { DriverName } from '../../drivers'
import DriverCommand from '../../driver-command'

// eslint-disable-next-line no-use-before-define
export default class CreateProfile extends DriverCommand<typeof CreateProfile> {
  static description = 'Create a new profile'

  static flags = {}

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

    const driverPrefix = `${driver}-`
    const driverFlags = mapKeys(
      pickBy(this.flags, (v, k) => k.startsWith(driverPrefix)),
      (_v, k) => k.substring(driverPrefix.length),
    )

    await this.profileConfig.create(alias, this.args.url, { driver }, async pStore => {
      await pStore.setDefaultFlags(
        driver,
        driverFlags
      )
      await ensureTunnelKeyPair({ store: pStore, log: this.logger })
    })
    return undefined
  }
}
