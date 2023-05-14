import { Args, Flags, ux } from '@oclif/core'
import { find, range, map } from 'iter-tools-es'
import { LocalProfilesConfig } from '@preevy/core'
import BaseCommand from '../../base-command'
import { onProfileChange } from '../../profile-command'

const DEFAULT_ALIAS_PREFIX = 'default'

const defaultAlias = async (profileConfig: LocalProfilesConfig) => {
  const profiles = new Set((await profileConfig.list()).map(l => l.alias))
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
      description: 'name of the profile',
      required: false,
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
    const alias = this.flags.name ?? await defaultAlias(this.profileConfig)

    const { info } = await this.profileConfig.importExisting(alias, this.args.location)
    onProfileChange(info, alias, this.args.location)
    ux.info(`Profile ${info.id} imported successfully as ${alias}`)
  }
}
