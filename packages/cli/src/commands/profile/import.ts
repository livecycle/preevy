import { Args, Flags, ux } from '@oclif/core'
import BaseCommand from '../../base-command'
import { onProfileChange } from '../../profile-command'

// eslint-disable-next-line no-use-before-define
export default class ImportProfile extends BaseCommand<typeof ImportProfile> {
  static description = 'Import an existing profile'

  static flags = {
    name: Flags.string({
      description: 'name of the profile',
      required: false,
      default: 'default',
    }),
  }

  static args = {
    location: Args.string({
      description: 'location of the profile',
      required: true,
    }),
  }

  static strict = false

  static enableJsonFlag = true

  async run(): Promise<void> {
    const alias = this.flags.name

    const { info } = await this.profileConfig.importExisting(alias, this.args.location)
    onProfileChange(info)
    ux.info(`Profile ${info.id} imported successfully`)
  }
}
