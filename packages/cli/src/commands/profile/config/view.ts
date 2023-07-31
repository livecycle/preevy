import { profileStore } from '@preevy/core'
import { ux } from '@oclif/core'
import {
  DriverName,
} from '../../../drivers'
import ProfileCommand from '../../../profile-command'

// eslint-disable-next-line no-use-before-define
export default class ViewProfileConfig extends ProfileCommand<typeof ViewProfileConfig> {
  static description = 'View profile configuration'

  static strict = false

  static enableJsonFlag = true

  async run(): Promise<void> {
    const pStore = profileStore(this.store)
    const driver = this.profile.driver as DriverName
    const origin = await pStore.defaultFlags(driver)
    ux.info(`Current configuration for ${driver}:`)
    ux.styledObject(origin)
  }
}
