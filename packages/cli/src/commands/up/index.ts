import os from 'os'
import { Args, Flags, ux } from '@oclif/core'
import MachineCreationDriverCommand from '../../machine-creation-driver-command'
import { up } from '../../lib/commands'
import { sshKeysStore } from '../../lib/state/ssh'
import { profileStore } from '../../lib/profile'
import { flattenTunnels, HostKeySignatureConfirmer, performTunnelConnectionCheck } from '../../lib/tunneling'
import { envIdFlags } from '../../lib/env-id'
import { composeFlags } from '../../lib/compose/flags'
import { carefulBooleanPrompt } from '../../lib/prompt'

const confirmHostFingerprint = async (
  { hostKeyFingerprint: hostKeySignature, hostname, port }: Parameters<HostKeySignatureConfirmer>[0],
) => {
  const formattedHost = port ? `${hostname}:${port}` : hostname
  const message = [
    `The authenticity of host '${formattedHost}' can't be established.`,
    `Key fingerprint is $${hostKeySignature}`,
    'Are you sure you want to continue connecting (yes/no)?',
  ].join(os.EOL)
  return carefulBooleanPrompt(message)
}

// eslint-disable-next-line no-use-before-define
export default class Up extends MachineCreationDriverCommand<typeof Up> {
  static description = 'Bring up a preview environment'

  static flags = {
    ...envIdFlags,
    ...composeFlags,
    'tunnel-url': Flags.string({
      description: 'Tunnel url, specify ssh://hostname[:port] or ssh+tls://hostname[:port]',
      char: 't',
      default: 'ssh+tls://livecycle.run' ?? process.env.PREVIEW_TUNNEL_OVERRIDE,
    }),
    'tls-hostname': Flags.string({
      description: 'Override TLS server name when tunneling via HTTPS',
      required: false,
    }),
    'insecure-skip-verify': Flags.boolean({
      description: 'Skip TLS or SSH certificate verification',
      default: false,
    }),
    ...ux.table.flags(),
  }

  static strict = false

  static args = {
    service: Args.string({
      description: 'Service name(s). If not specified, will deploy all services',
      required: false,
    }),
  }

  async run(): Promise<unknown> {
    const { flags, raw } = await this.parse(Up)
    const restArgs = raw.filter(arg => arg.type === 'arg').map(arg => arg.input)

    const driver = await this.driver()
    const machineCreationDriver = await this.machineCreationDriver()
    const keyAlias = await driver.getKeyPairAlias()

    const keyStore = sshKeysStore(this.store)
    let keyPair = await keyStore.getKey(keyAlias)
    if (!keyPair) {
      this.logger.info(`key pair ${keyAlias} not found, creating a new key pair`)
      keyPair = await driver.createKeyPair()
      await keyStore.addKey(keyPair)
      this.logger.info(`keypair ${keyAlias} created`)
    }

    const pStore = profileStore(this.store)
    const tunnelingKey = await pStore.getTunnelingKey()
    if (!tunnelingKey) {
      throw new Error('Tunneling key is not configured correctly, please recreate the profile')
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

    const { machine, tunnels, envId } = await up({
      userSpecifiedServices: restArgs,
      debug: flags.debug,
      machineDriver: driver,
      machineCreationDriver,
      userSpecifiedProjectName: flags.project,
      userSpecifiedEnvId: flags.id,
      tunnelOpts,
      composeFiles: flags.file,
      log: this.logger,
      dataDir: this.config.dataDir,
      sshKey: keyPair,
      sshTunnelPrivateKey: tunnelingKey,
      allowedSshHostKeys: hostKey,
    })

    const flatTunnels = flattenTunnels(tunnels)

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
