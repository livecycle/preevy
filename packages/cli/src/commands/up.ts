import { Args, Flags, ux, Errors } from '@oclif/core'
import {
  addBaseComposeTunnelAgentService,
  commands, findComposeTunnelAgentUrl,
  findEnvId,
  findProjectName, getTunnelNamesToServicePorts, jwkThumbprint, profileStore,
  telemetryEmitter,
  withSpinner,
} from '@preevy/core'
import { argsFromRaw, tunnelServerFlags } from '@preevy/cli-common'
import { inspect } from 'util'
import { editUrl, tunnelNameResolver } from '@preevy/common'
import MachineCreationDriverCommand from '../machine-creation-driver-command'
import { envIdFlags, urlFlags } from '../common-flags'
import { filterUrls, printUrls, writeUrlsToFile } from './urls'
import { connectToTunnelServerSsh } from '../tunnel-server-client'

// eslint-disable-next-line no-use-before-define
export default class Up extends MachineCreationDriverCommand<typeof Up> {
  static description = 'Bring up a preview environment'

  static flags = {
    ...envIdFlags,
    ...tunnelServerFlags,
    'local-build': Flags.custom<commands.LocalBuildSpec>({
      description: `Build locally and deploy remotely using an image registry; ${Object.entries(commands.localBuildSpecSchema.shape).map(([k, v]) => `${k}: ${v.description}`).join(', ')}`,
      required: false,
      parse: async input => {
        const pairs = input.split(',')
        const result = commands.localBuildSpecSchema.safeParse(Object.fromEntries(pairs.map(pair => pair.split('='))))
        if (!result.success) {
          throw new Errors.CLIError(`Invalid local build arg: ${inspect(result.error)}`)
        }
        return result.data
      },
    })(),
    'skip-unchanged-files': Flags.boolean({
      description: 'Detect and skip unchanged files when copying (default: true)',
      default: true,
      allowNo: true,
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
    ...urlFlags,
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
    const restArgs = argsFromRaw(raw)

    const driver = await this.driver()
    const machineCreationDriver = await this.machineCreationDriver()
    const userModel = await this.ensureUserModel()

    const { projectName } = await findProjectName({
      userSpecifiedProjectName: flags.project,
      userModel,
    })

    const envId = await findEnvId({
      log: this.logger,
      userSpecifiedEnvId: flags.id,
      userSpecifiedProjectName: flags.project,
      userModel,
    })

    const pStore = profileStore(this.store)
    const tunnelingKey = await withSpinner(
      () => pStore.getTunnelingKey(),
      { text: 'Getting tunneling key from profile...', successText: 'Got tunneling key from profile' },
    )
    const thumbprint = await jwkThumbprint(tunnelingKey)

    const tunnelOpts = {
      url: flags['tunnel-url'],
      tlsServerName: flags['tls-hostname'],
      insecureSkipVerify: flags['insecure-skip-verify'],
    }

    const expectedTunnels = getTunnelNamesToServicePorts(
      addBaseComposeTunnelAgentService(userModel),
      tunnelNameResolver({ envId }),
    )

    const { hostKey, expectedServiceUrls } = await withSpinner(async spinner => {
      spinner.text = 'Connecting...'

      const { hostKey: hk, client: tunnelServerSshClient } = await connectToTunnelServerSsh({
        tunnelingKey,
        knownServerPublicKeys: pStore.knownServerPublicKeys,
        tunnelOpts,
        log: this.logger,
        spinner,
      })

      spinner.text = 'Getting server details...'

      const [{ clientId }, expectedTunnelUrls] = await Promise.all([
        tunnelServerSshClient.execHello(),
        tunnelServerSshClient.execTunnelUrl(Object.keys(expectedTunnels)),
      ])

      this.logger.debug('Tunnel server details: %j', { clientId, expectedTunnelUrls })

      void tunnelServerSshClient.end()

      telemetryEmitter().group({ type: 'profile' }, { proxy_client_id: clientId })

      const esu = Object.entries(expectedTunnels)
        .map(([tunnel, { name, port }]) => ({ name, port, url: expectedTunnelUrls[tunnel] }))

      return { hostKey: hk, expectedServiceUrls: esu }
    }, { opPrefix: 'Tunnel server', successText: 'Got tunnel server details' })

    this.logger.debug('expectedServiceUrls: %j', expectedServiceUrls)

    const injectWidgetScript = flags['enable-widget']
      ? editUrl(flags['livecycle-widget-url'], { queryParams: { profile: thumbprint, env: envId } }).toString()
      : undefined

    const { machine } = await commands.up({
      projectName,
      expectedServiceUrls,
      userSpecifiedServices: restArgs,
      debug: flags.debug,
      machineDriver: driver,
      machineDriverName: this.driverName,
      machineCreationDriver,
      userSpecifiedProjectName: flags.project,
      composeFiles: this.config.composeFiles,
      envId,
      scriptInjections: injectWidgetScript ? { 'livecycle-widget': { src: injectWidgetScript } } : undefined,
      tunnelOpts,
      log: this.logger,
      dataDir: this.config.dataDir,
      sshTunnelPrivateKey: tunnelingKey,
      allowedSshHostKeys: hostKey,
      cwd: process.cwd(),
      skipUnchangedFiles: flags['skip-unchanged-files'],
      version: this.config.version,
      localBuildSpec: flags['local-build'],
    })

    this.log(`Preview environment ${envId} provisioned at: ${machine.locationDescription}`)

    const composeTunnelServiceUrl = findComposeTunnelAgentUrl(expectedServiceUrls)
    const flatTunnels = await withSpinner(() => commands.urls({
      composeTunnelServiceUrl,
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
      context: { log: this.logger, userModel },
      filters: this.config.preevyHooks.filterUrls,
    })

    await Promise.all(
      this.config.preevyHooks.envCreated.map(envCreated => envCreated(
        { log: this.logger, userModel },
        { envId, urls },
      )),
    )

    await writeUrlsToFile({ log: this.logger }, flags, urls)

    if (flags.json) {
      return urls
    }

    printUrls(urls, flags)

    return undefined
  }
}
