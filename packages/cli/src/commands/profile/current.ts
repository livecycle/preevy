import { ux } from '@oclif/core'
import ProfileCommand from '../../profile-command'

// eslint-disable-next-line no-use-before-define
export default class CurrentProfile extends ProfileCommand<typeof CurrentProfile> {
  static description = 'Display current profile in use'
  static strict = false

  static enableJsonFlag = true

  async run(): Promise<unknown> {
    const currentProfile = await this.profileConfig.current()
    if (!currentProfile) {
      return ux.info('No profile is loaded, use init command to create or import a new profile')
    }
    const { alias, id, location } = currentProfile
    return ux.table([{ alias, id, location }], {
      alias: { header: 'Alias' },
      id: { header: 'ID' },
      location: { header: 'Location' },
    })
  }
}
