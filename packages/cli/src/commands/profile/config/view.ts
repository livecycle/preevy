import { profileStore } from '@preevy/core'
import { ux } from '@oclif/core'
import { text } from '@preevy/cli-common'
import { DriverName } from '../../../drivers.js'
import ProfileCommand from '../../../profile-command.js'

// eslint-disable-next-line no-use-before-define
export default class ViewProfileConfig extends ProfileCommand<typeof ViewProfileConfig> {
  static description = 'View profile configuration'
  static enableJsonFlag = true

  async run(): Promise<unknown> {
    const pStore = profileStore(this.store).ref
    const driver = this.profile.driver as DriverName | undefined
    if (!driver) {
      if (this.jsonEnabled()) {
        return { driver: null, defaultFlags: {} }
      }
      ux.info('No driver specified in profile.')
      ux.info(`Run ${text.command(this.config, 'profile config update --driver <driver>')} to set a driver`)
      return undefined
    }

    const config = await pStore.defaultDriverFlags(driver)
    if (this.jsonEnabled()) {
      return { driver, defaultFlags: config }
    }
    ux.info(`Current configuration for driver ${text.code(driver)}:`)
    if (Object.keys(config).length) {
      ux.styledObject(config)
    } else {
      ux.info('(empty)')
    }
    return undefined
  }
}
