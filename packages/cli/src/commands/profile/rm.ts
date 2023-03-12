import { Args, Flags, ux } from '@oclif/core'
import { mapKeys, pickBy } from 'lodash'
import DriverCommand from '../../driver-command'
import { DriverName } from '../../lib/machine'

export default class RemoveProfile extends DriverCommand<typeof RemoveProfile> {
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
      await this.profileManager.delete(alias)
      ux.info(`Profile ${alias} removed`)
      ux.info('the files are still available in the store if you want to restore it')
      return undefined
    }
}
