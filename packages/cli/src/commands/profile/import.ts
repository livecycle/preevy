import { Args, Flags, ux } from '@oclif/core'
import { fsTypeFromUrl, nextAvailableAlias } from '@preevy/core'
import { BaseCommand, text } from '@preevy/cli-common'
import { EOL } from 'os'
import { loadProfileConfig, onProfileChange } from '../../profile-command.js'


export default class ImportProfile extends BaseCommand<typeof ImportProfile> {
  static description = 'Import an existing profile'

  static flags = {
    name: Flags.string({
      description: 'Name of the profile',
      required: false,
    }),
    use: Flags.boolean({
      description: 'Mark the new profile as the current profile',
      required: false,
    }),
  }

  static args = {
    location: Args.string({
      description: 'URL of the profile',
      required: true,
    }),
  }

  async run(): Promise<void> {
    const profileConfig = loadProfileConfig(this.config)
    let alias = this.flags.name
    if (alias) {
      if (await profileConfig.has(alias)) {
        ux.error([
          `A profile with the alias ${text.code(alias)} already exists.`,
          `Run ${text.command(this.config, 'profile ls')} to list existing profiles.`,
          `Run ${text.command(this.config, 'profile rm <profile-alias>')} to remove an existing profile.`,
        ].join(EOL))
      }
    } else {
      alias = nextAvailableAlias(Object.keys((await profileConfig.list()).profiles))
    }

    const { info } = await profileConfig.importExisting(alias, this.args.location, this.flags.use)
    onProfileChange(info, fsTypeFromUrl(this.args.location))
    ux.info(text.success(`Profile ${text.code(info.id)} imported successfully as ${text.code(alias)} 👍`))
  }
}
