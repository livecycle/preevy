import { ux } from '@oclif/core'
import { asyncToArray } from 'iter-tools-es'
import DriverCommand from '../../driver-command'
import { ls } from '../../lib/commands'
import { fsState } from '../../lib/state'
import { realFs } from '../../lib/state/fs'

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

    const state = fsState(realFs(this.config.dataDir))

    const machines = await asyncToArray(await ls({ machineDriver: this.machineDriver, log: this.logger, state }))

    if (flags.json) {
      return machines
    }

    ux.table(
      machines,
      {
        envId: { header: 'Env' },
        providerId: { header: 'Driver ID' },
        publicIPAddress: { header: 'IP address' },
        haveSshKey: { header: 'SSH Key' },
        version: { header: 'Version', extended: true },
      },
      this.flags,
    )

    return undefined
  }
}
