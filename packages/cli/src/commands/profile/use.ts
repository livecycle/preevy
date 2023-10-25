import { Args, ux } from '@oclif/core'
import { BaseCommand } from '@preevy/cli-common'
import { loadProfileConfig } from '../../profile-command'

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
    ux.info(`Profile ${alias} is now being used`)
    return undefined
  }
}
