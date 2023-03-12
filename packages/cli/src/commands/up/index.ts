import os from 'os'
import { Flags, ux } from '@oclif/core'
import DriverCommand from '../../driver-command'
import { up } from '../../lib/commands'
import { fsState } from '../../lib/state'
import { realFs } from '../../lib/state/fs'
import { HostKeySignatureConfirmer } from '../../lib/commands/up'

type FlatTunnel = {
  project: string
  service: string
  port: number
  url: string
}

const confirmHostFingerprint = async (
  { hostKeyFingerprint: hostKeySignature, hostname, port }: Parameters<HostKeySignatureConfirmer>[0],
) => {
  const formattedHost = port ? `${hostname}:${port}` : hostname
  const message = [
    `The authenticity of host '${formattedHost}' can't be established.`,
    `Key fingerprint is $${hostKeySignature}`,
    'Are you sure you want to continue connecting (yes/no)?',
  ].join(os.EOL)
  const handleResponse = async (response: string): Promise<boolean> => {
    if (!['yes', 'no'].includes(response)) {
      const newResponse = await ux.prompt('Please type yes or no', { required: true })
      return handleResponse(newResponse)
    }
    return response === 'yes'
  }

  const response = await ux.prompt(message, { default: 'no', required: true })
  return handleResponse(response)
}

export default class Up extends DriverCommand<typeof Up> {
  static description = 'Bring up a preview environment'

  static flags = {
    id: Flags.string({ description: 'Environment id', required: true }),
    file: Flags.string({
      description: 'Compose configuration file',
      multiple: true,
      required: false,
      char: 'f',
    }),
    'tunnel-url': Flags.string({
      description: 'Tunnel url, specify ssh://hostname[:port] or ssh+tls://hostname[:port]',
      char: 't',
      default: 'livecycle.run',
    }),
    'tls-hostname': Flags.string({
      description: 'Override TLS servername when tunneling via HTTPS',
      required: false,
    }),
    'insecure-skip-verify': Flags.boolean({
      description: 'Skip TLS or SSH certificate verification',
      default: false,
    }),
    ...ux.table.flags(),
  }

  static args = {
  }

  async run(): Promise<unknown> {
    const { flags } = await this.parse(Up)
    const { id: envId } = flags

    const state = fsState(realFs(this.config.dataDir))

    const { machine, tunnels } = await up({
      machineDriver: this.machineDriver,
      tunnelOpts: {
        url: flags['tunnel-url'],
        tlsServerName: flags['tls-hostname'],
        insecureSkipVerify: flags['insecure-skip-verify'],
      },
      envId,
      composeFiles: flags.file,
      log: this.logger,
      state,
      dataDir: this.config.dataDir,
      projectDir: process.cwd(),
      confirmHostFingerprint: async o => {
        const confirmed = await confirmHostFingerprint(o)
        if (!confirmed) {
          this.log('Exiting')
          this.exit(0)
        }
      },
    })

    const flatTunnels: FlatTunnel[] = tunnels
      .map(t => Object.entries(t.ports).map(([port, urls]) => urls.map(url => ({ ...t, port: Number(port), url }))))
      .flat(2)

    if (flags.json) {
      return flatTunnels
    }

    this.log(`Preview environment ${envId} provisioned: ${machine.publicIPAddress}`)

    ux.table(
      flatTunnels,
      {
        service: { header: 'Service' },
        port: { header: 'Port' },
        url: { header: 'URL' },
      },
      this.flags,
    )

    return undefined
  }
}
