import { ux } from '@oclif/core'
import ProfileCommand from '../../profile-command.js'


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
    const result = { alias, id, location }
    return this.jsonEnabled() ? result : ux.styledObject(result)
  }
}
