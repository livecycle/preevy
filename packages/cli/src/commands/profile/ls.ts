import { ux } from '@oclif/core'
import ProfileCommand from '../../profile-command'

// eslint-disable-next-line no-use-before-define
export default class ListProfile extends ProfileCommand<typeof ListProfile> {
  static description = 'Lists profiles'

  static strict = false

  static enableJsonFlag = true

  async run(): Promise<unknown> {
    const currentProfile = await this.profileConfig.current()
    const profiles = await this.profileConfig.list()

    if (this.flags.json) {
      return profiles
    }
    ux.table(profiles, {
      alias: {
        header: 'Alias',
        get: ({ alias }) => `${alias}${alias === currentProfile?.alias ? ' *' : ''}`,
      },
      id: {
        header: 'Id',
      },
      location: {
        header: 'Location',
      },
    }, this.flags)

    return undefined
  }
}
