import { ux, Args, Flags } from '@oclif/core'
import { jwkThumbprint, commands, profileStore, withSpinner, SshConnection, machineId, normalizeEnvId } from '@preevy/core'
import { tunnelServerFlags, urlFlags } from '@preevy/cli-common'
import { inspect } from 'util'
import { formatPublicKey } from '@preevy/common'
import { spawn } from 'child_process'
import { connectToTunnelServerSsh } from '../../tunnel-server-client'
import ProfileCommand from '../../profile-command'
import { filterUrls, printUrls } from '../urls'

// eslint-disable-next-line no-use-before-define
export default class Connect extends ProfileCommand<typeof Connect> {
  static description = 'Tunnel existing local compose application'

  static flags = {
    ...tunnelServerFlags,
    ...urlFlags,
    ...ux.table.flags(),
    'private-env': Flags.boolean({
      description: 'Mark all services as private',
      default: false,
      required: false,
    }),
  }

  static strict = false
  static hidden = true

  static args = {
    'compose-project': Args.string({
      description: 'Compose Project name',
      required: true,
    }),
  }

  static enableJsonFlag = true

  // eslint-disable-next-line class-methods-use-this
  async run(): Promise<unknown> {
    const { flags, args, store } = this

    const pStore = profileStore(store)

    const tunnelingKey = await pStore.getTunnelingKey()
    const tunnelOpts = {
      url: flags['tunnel-url'],
      tlsServerName: flags['tls-hostname'],
      insecureSkipVerify: flags['insecure-skip-verify'],
    }
    const composeProject = args['compose-project']
    const deviceId = (await machineId(this.config.dataDir)).substring(0, 2)
    const envId = normalizeEnvId(`${composeProject}-dev-${deviceId}`) // local+find_ambient_id_based on compose dir (?)
    let client: SshConnection['client'] | undefined
    let hostKey: Buffer
    let preevyAgentUrl: string
    try {
      const connnection = (await connectToTunnelServerSsh({
        tunnelOpts,
        knownServerPublicKeys: pStore.knownServerPublicKeys,
        tunnelingKey,
        log: this.logger,
      }))
      client = connnection.client
      hostKey = connnection.hostKey
      preevyAgentUrl = await commands.proxy.getPreevyAgentUrl(client, envId)
    } finally {
      client?.close()
    }
    const tunnelServerPublicKey = formatPublicKey(hostKey)

    const inspector = commands.proxy.inspectRunningComposeApp(composeProject)
    const networks = await inspector.getComposeNetworks()

    const model = commands.proxy.initProxyComposeModel({
      envId,
      projectName: composeProject,
      tunnelOpts,
      networks,
      privateMode: flags['private-env'],
      tunnelingKeyThumbprint: await jwkThumbprint(tunnelingKey),
    })

    const composeTmpDir = await model.write({ tunnelingKey, knownServerPublicKey: tunnelServerPublicKey })

    const proc = spawn('docker', ['compose', 'up', '--build', '-d'], { cwd: composeTmpDir })
    proc.stdout?.pipe(process.stderr)
    proc.stderr?.pipe(process.stderr)

    const exitCode = await new Promise<number>(res => {
      proc.on('exit', code => res(code ?? 0))
    })
    if (exitCode !== 0) {
      this.exit(exitCode) // or should we throw?
    }

    const flatTunnels = await withSpinner(() => commands.urls({
      composeTunnelServiceUrl: preevyAgentUrl,
      tunnelingKey,
      includeAccessCredentials: flags['include-access-credentials'],
      showPreevyService: flags['show-preevy-service-urls'],
      retryOpts: {
        minTimeout: 1000,
        maxTimeout: 2000,
        retries: 10,
        onFailedAttempt: e => { this.logger.debug(`Failed to query tunnels: ${inspect(e)}`) },
      },
    }), { text: 'Getting tunnel URLs...' })

    const urls = await filterUrls({
      flatTunnels,
      context: {
        log: this.logger,
        userModel: { name: composeProject },
      },
      filters: this.config.preevyHooks.filterUrls,
    })

    if (flags.json) {
      return urls
    }
    printUrls(urls, flags)

    return undefined
  }
}
