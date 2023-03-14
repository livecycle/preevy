import os from 'os'
import { Flags, ux } from '@oclif/core'
import DriverCommand from '../../driver-command'
import { up } from '../../lib/commands'
import { sshKeysStore } from '../../lib/state/ssh'
import { profileStore } from '../../lib/profile'
import { HostKeySignatureConfirmer, performTunnelConnectionCheck } from '../../lib/tunneling'

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
      default: process.env.NODE_ENV
        ? 'ssh+tls://livecycle.run'
        : 'ssh+tls://local.livecycle.run:8044',
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
    const driver = await this.machineDriver()
    const keyAlias = await driver.getKeyPairAlias()

    const keyStore = sshKeysStore(this.store)
    let keyPair = await keyStore.getKey(keyAlias)
    if (!keyPair) {
      this.logger.info(`keypair ${keyAlias} not found, creating new one`)
      keyPair = await driver.createKeyPair()
      await keyStore.addKey(keyPair)
      this.logger.info(`keypair ${keyAlias} created`)
    }

    const pStore = profileStore(this.store)
    const tunnelingKey = await pStore.getTunnelingKey()
    if (!tunnelingKey) {
      throw new Error('Tunneling key is not configured correctly, please recrate the profile')
    }

    const tunnelOpts = {
      url: flags['tunnel-url'],
      tlsServerName: flags['tls-hostname'],
      insecureSkipVerify: flags['insecure-skip-verify'],
    }

    const { hostKey } = await performTunnelConnectionCheck({
      log: this.logger,
      tunnelOpts,
      clientPrivateKey: tunnelingKey,
      username: process.env.USER || 'preview',
      confirmHostFingerprint: async o => {
        const confirmed = await confirmHostFingerprint(o)
        if (!confirmed) {
          this.log('Exiting')
          this.exit(0)
        }
      },
      keysState: pStore.knownServerPublicKeys,
    })

    const { machine, tunnels } = await up({
      machineDriver: driver,
      envId,
      tunnelOpts,
      composeFiles: flags.file,
      log: this.logger,
      dataDir: this.config.dataDir,
      projectDir: process.cwd(),
      sshKey: keyPair,
      sshTunnelPrivateKey: tunnelingKey,
      AllowedSshHostKeys: hostKey,
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
