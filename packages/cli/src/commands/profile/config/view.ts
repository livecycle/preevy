import { profileStore } from '@preevy/core'
import { ux } from '@oclif/core'
import { EOL } from 'os'
import chalk from 'chalk'
import { DriverName } from '../../../drivers'
import ProfileCommand from '../../../profile-command'

// eslint-disable-next-line no-use-before-define
export default class ViewProfileConfig extends ProfileCommand<typeof ViewProfileConfig> {
  static description = 'View profile configuration'
  static enableJsonFlag = true

  async run(): Promise<unknown> {
    const pStore = profileStore(this.store)
    const driver = this.profile.driver as DriverName
    const config = await pStore.defaultFlags(driver)
    if (!driver) {
      ux.error([
        'Missing driver configuration in profile.',
        `Run ${chalk.bold(`${this.config.bin} profile config update --driver <driver>`)} to set the desired machine driver`,
      ].join(EOL))
    }
    if (this.flags.json) {
      return { driver, defaultFlags: config }
    }
    ux.info(`Current configuration for driver ${chalk.bold(driver)}:`)
    if (Object.keys(config).length) {
      ux.styledObject(config)
    } else {
      ux.info('(empty)')
    }
    return undefined
  }
}
