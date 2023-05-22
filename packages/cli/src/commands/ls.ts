import { ux } from '@oclif/core'
import { asyncMap, asyncToArray } from 'iter-tools-es'
import { commands } from '@preevy/core'
import DriverCommand from '../driver-command'

// eslint-disable-next-line no-use-before-define
export default class Ls extends DriverCommand<typeof Ls> {
  static description = 'List preview environments'

  static flags = {
    ...ux.table.flags(),
  }

  static args = {
  }

  static enableJsonFlag = true

  async run(): Promise<unknown> {
    const { flags } = await this.parse(Ls)
    const driver = await this.driver()
    const machines = await asyncToArray(asyncMap(x => {
      if ('publicIPAddress' in x) {
        return { ...x, partial: false }
      }
      return { ...x, partial: true }
    }, await commands.ls({ machineDriver: driver, log: this.logger })))

    if (flags.json) {
      return machines
    }

    ux.table(
      machines,
      {
        envId: { header: 'Env' },
        providerId: { header: 'Driver ID' },
        publicIPAddress: { header: 'IP address' },
        version: { header: 'Version', extended: true },
        partial: { header: 'Partial' },
      },
      this.flags,
    )

    return undefined
  }
}
