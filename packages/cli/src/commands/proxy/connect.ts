import { ux, Args, Flags } from '@oclif/core'
import { jwkThumbprint, commands, profileStore, withSpinner, SshConnection, machineId, validateEnvId, normalizeEnvId, EnvId } from '@preevy/core'
import { tunnelServerFlags, urlFlags } from '@preevy/cli-common'
import { inspect } from 'util'
import { formatPublicKey } from '@preevy/common'
import { spawn } from 'child_process'
import { connectToTunnelServerSsh } from '../../tunnel-server-client'
import ProfileCommand from '../../profile-command'
import { filterUrls, printUrls, writeUrlsToFile } from '../urls'

// eslint-disable-next-line no-use-before-define
export default class Connect extends ProfileCommand<typeof Connect> {
  static description = 'Tunnel existing local compose application'

  static flags = {
    ...tunnelServerFlags,
    ...urlFlags,
    ...ux.table.flags(),
    id: Flags.string({
      aliases: ['env-id'],
      description: 'specify the environment ID for this app',
      required: false,
    }),
    'enable-widget': Flags.boolean({
      default: false,
      hidden: true,
    }),
    'livecycle-widget-url': Flags.string({
      required: true,
      hidden: true,
      env: 'LIVECYCLE_WIDGET_URL',
      default: 'https://app.livecycle.run/widget/widget-bootstrap.js',
    }),
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
    let envId:EnvId
    if (flags.id) {
      envId = validateEnvId(flags.id)
    } else {
      const deviceId = (await machineId(this.config.dataDir)).substring(0, 2)
      envId = normalizeEnvId(`${composeProject}-dev-${deviceId}`)
      this.logger.info(`Using environment ID ${envId}, based on Docker Compose and local device`)
    }
    let client: SshConnection['client'] | undefined
    let hostKey: Buffer
    let preevyAgentUrl: string
    try {
      const connnection = await connectToTunnelServerSsh({
        tunnelOpts,
        knownServerPublicKeys: pStore.knownServerPublicKeys,
        tunnelingKey,
        log: this.logger,
      })
      client = connnection.client
      hostKey = connnection.hostKey
      preevyAgentUrl = await commands.proxy.getPreevyAgentUrl(client, envId)
    } finally {
      void client?.end()
    }
    const tunnelServerPublicKey = formatPublicKey(hostKey)

    const inspector = commands.proxy.inspectRunningComposeApp(composeProject)
    const networks = await inspector.getComposeNetworks()
    const projectDirectory = await inspector.getWorkingDirectory()
    const thumbprint = await jwkThumbprint(tunnelingKey)
    const model = await commands.proxy.initProxyComposeModel({
      version: this.config.version,
      envId,
      debug: this.flags.debug,
      projectName: composeProject,
      tunnelOpts,
      networks,
      privateMode: flags['private-env'],
      injectLivecycleScript: flags['enable-widget'] ? `${flags['livecycle-widget-url']}?profile=${thumbprint}&env=${envId}` : undefined,
      tunnelingKeyThumbprint: thumbprint,
      projectDirectory,
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
      includeAccessCredentials: flags['include-access-credentials'] && (flags['access-credentials-type'] as 'api' | 'browser'),
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

    await writeUrlsToFile({ log: this.logger }, flags, urls)

    if (flags.json) {
      return urls
    }
    printUrls(urls, flags)

    return undefined
  }
}
