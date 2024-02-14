import { Flags, ux } from '@oclif/core'
import { tableFlags } from '@preevy/cli-common'
import ProfileCommand from '../../profile-command.js'

// eslint-disable-next-line no-use-before-define
export default class ListProfile extends ProfileCommand<typeof ListProfile> {
  static description = 'Lists profiles'

  static enableJsonFlag = true

  static flags = {
    ...tableFlags,
    json: Flags.boolean({}),
  }

  protected throwOnProfileNotFound = false

  async run(): Promise<unknown> {
    const { profiles, current } = await this.profileConfig.list()

    if (this.jsonEnabled()) {
      return { profiles, current }
    }

    ux.table(Object.values(profiles), {
      alias: {
        header: 'Alias',
        get: ({ alias }) => `${alias}${alias === current ? ' *' : ''}`,
      },
      id: {
        header: 'Id',
      },
      location: {
        header: 'Location',
      },
    }, this.flags)

    return undefined
  }
}
