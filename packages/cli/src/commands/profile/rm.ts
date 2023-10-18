import { Args, ux } from '@oclif/core'
import { text } from '@preevy/cli-common'
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
    ux.info(text.success(`Profile ${text.code(alias)} removed.`))
    return undefined
  }
}
