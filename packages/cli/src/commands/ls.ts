import { ux } from '@oclif/core'
import { asyncMap, asyncToArray } from 'iter-tools-es'
import { commands } from '@preevy/core'
import { tableFlags } from '@preevy/cli-common'
import DriverCommand from '../driver-command'

// eslint-disable-next-line no-use-before-define
export default class Ls extends DriverCommand<typeof Ls> {
  static description = 'List preview environments'

  static flags = {
    ...tableFlags,
  }

  static args = {
  }

  static enableJsonFlag = true

  async run(): Promise<unknown> {
    const { flags } = this
    const driver = await this.driver()
    const machines = await asyncToArray(
      asyncMap(
        x => ({ ...x, state: ('error' in x) ? x.error : 'OK' }),
        await commands.ls({ machineDriver: driver, log: this.logger }),
      ),
    )

    if (flags.json) {
      return machines
    }

    ux.table(
      machines,
      {
        envId: { header: 'Env' },
        providerId: { header: 'Driver ID' },
        locationDescription: { header: 'Location' },
        version: { header: 'Version', extended: true },
        state: { header: 'State' },
      },
      this.flags,
    )

    return undefined
  }
}
