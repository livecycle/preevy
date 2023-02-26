import { Flags } from '@oclif/core'
import DriverCommand from '../../driver-command'
import { up } from '../../lib/commands'
import { fsState } from '../../lib/state'
import { realFs } from '../../lib/state/fs'

export default class Up extends DriverCommand<typeof Up> {
  static description = 'Bring up a preview environment'

  static flags = {
    id: Flags.string({ description: 'Environment id', required: true }),
    ['tunnel-hostname']: Flags.string({ 
      description: 'Tunnel hostname', 
      char: 't',
      default: process.env.NODE_ENV 
        ? 'machines.preview.livecycle.dev'
        : 'machines.preview.local.livecycle.xyz',
    }),
    ['tls-hostname']: Flags.string({
      description: 'Override TLS servername when tunneling via HTTPS',
      required: false,
    }),
  }

  static args = {
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(Up)
    const { id: envId } = flags

    const state = fsState(realFs(this.config.dataDir))

    const { machine } = await up({ 
      machineDriver: this.machineDriver, 
      tunnelOpts: {
        hostname: flags['tunnel-hostname'],
        tlsServername: flags['tls-hostname'],
      },
      envId, 
      log: this.logger, state,
    })
    this.log(`Preview environment ${envId} provisioned: ${machine.publicIPAddress}`)
  }
}
