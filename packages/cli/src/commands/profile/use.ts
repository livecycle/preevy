import { Args, ux } from '@oclif/core'
import { BaseCommand, text } from '@preevy/cli-common'
import { loadProfileConfig } from '../../profile-command.js'

// eslint-disable-next-line no-use-before-define
export default class UseProfile extends BaseCommand<typeof UseProfile> {
  static description = 'Set current profile'

  static args = {
    name: Args.string({
      description: 'name of the profile to use',
      required: true,
    }),
  }

  async run(): Promise<unknown> {
    const alias = this.args.name
    const profileConfig = loadProfileConfig(this.config)
    await profileConfig.setCurrent(alias)
    ux.info(text.success(`Profile ${text.code(alias)} is now being used`))
    return undefined
  }
}
