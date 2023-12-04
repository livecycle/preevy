import { Args, Flags } from '@oclif/core'
import { find, range, map } from 'iter-tools-es'
import { fsTypeFromUrl } from '@preevy/core'
import { BaseCommand, text } from '@preevy/cli-common'
import { loadProfileConfig, onProfileChange } from '../../profile-command'

const DEFAULT_ALIAS_PREFIX = 'default'

const defaultAlias = async (aliases: string[]) => {
  const profiles = new Set(aliases)
  return find(
    (alias: string) => !profiles.has(alias),
    map(suffix => (suffix ? `${DEFAULT_ALIAS_PREFIX}${suffix + 1}` : DEFAULT_ALIAS_PREFIX), range()),
  ) as string
}

// eslint-disable-next-line no-use-before-define
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
    const aliases = Object.keys((await profileConfig.list()).profiles)
    const alias = this.flags.name ?? await defaultAlias(aliases)

    const { info } = await profileConfig.importExisting(alias, this.args.location, this.flags.use)
    onProfileChange(info, fsTypeFromUrl(this.args.location))
    text.success(`Profile ${text.code(info.id)} imported successfully as ${text.code(alias)} 👍`)
  }
}
