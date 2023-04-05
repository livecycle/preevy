import { Args, ux } from '@oclif/core'
import ProfileCommand from '../../profile-command'

// eslint-disable-next-line no-use-before-define
export default class RemoveProfile extends ProfileCommand<typeof RemoveProfile> {
  static description = 'Remove a profile'

  static args = {
    name: Args.string({
      description: 'name of the profile to remove',
      required: true,
    }),
  }

  static strict = false

  static enableJsonFlag = true

  async run(): Promise<unknown> {
    const alias = this.args.name
    await this.profileConfig.delete(alias)
    ux.info(`Profile ${alias} removed`)
    ux.info('the files are still available in the store if you want to restore it')
    return undefined
  }
}
