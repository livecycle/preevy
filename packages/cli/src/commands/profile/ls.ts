import { Args, ux } from '@oclif/core'
import DriverCommand from '../../driver-command'

export default class ListProfile extends DriverCommand<typeof ListProfile> {
    static description = 'Lists profiles'

    static strict = false

    static enableJsonFlag = true

    async run(): Promise<unknown> {
      const currentProfile = await this.profileConfig.current()
      const profiles = await this.profileConfig.list()

      ux.table(profiles, {
        alias: {
          header: 'Alias',
          get: ({ alias }) => `${alias}${alias === currentProfile?.alias ? ' *' : ''}`,
        },
        id: {
          header: 'Id',
        },
        location: {
          header: 'Location',
        },
      })

      return undefined
    }
}
