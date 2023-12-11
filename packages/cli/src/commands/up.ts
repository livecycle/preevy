import { Args, Flags } from '@oclif/core'
import {
  ComposeModel,
  Logger,
  ProfileStore,
  TunnelOpts,
  addBaseComposeTunnelAgentService,
  commands, defaultVolumeSkipList, ensureMachine, findComposeTunnelAgentUrl,
  findEnvId,
  findProjectName, getTunnelNamesToServicePorts, jwkThumbprint, profileStore,
  telemetryEmitter,
  withSpinner,
} from '@preevy/core'
import { buildFlags, parseBuildFlags, tableFlags, text, tunnelServerFlags } from '@preevy/cli-common'
import { inspect } from 'util'
import { editUrl, tunnelNameResolver } from '@preevy/common'
import MachineCreationDriverCommand from '../machine-creation-driver-command'
import { envIdFlags, urlFlags } from '../common-flags'
import { filterUrls, printUrls, writeUrlsToFile } from './urls'
import { connectToTunnelServerSsh } from '../tunnel-server-client'

const fetchTunnelServerDetails = async ({
  log,
  tunnelingKey,
  envId,
  userModel,
  pStore,
  tunnelOpts,
}: {
  log: Logger
  tunnelingKey: string | Buffer
  envId: string
  userModel: ComposeModel
  pStore: ProfileStore
  tunnelOpts: TunnelOpts
}) => {
  const expectedTunnels = getTunnelNamesToServicePorts(
    addBaseComposeTunnelAgentService(userModel),
    tunnelNameResolver({ envId }),
  )

  const { hostKey, expectedServiceUrls } = await withSpinner(async spinner => {
    spinner.text = 'Connecting...'

    const { hostKey: hk, client: tunnelServerSshClient } = await connectToTunnelServerSsh({
      tunnelingKey,
      profileStore: pStore,
      tunnelOpts,
      log,
      spinner,
    })

    spinner.text = 'Getting server details...'

    const [{ clientId }, expectedTunnelUrls] = await Promise.all([
      tunnelServerSshClient.execHello(),
      tunnelServerSshClient.execTunnelUrl(Object.keys(expectedTunnels)),
    ])

    log.debug('Tunnel server details: %j', { clientId, expectedTunnelUrls })

    void tunnelServerSshClient.end()

    telemetryEmitter().group({ type: 'profile' }, { proxy_client_id: clientId })

    const esu = Object.entries(expectedTunnels)
      .map(([tunnel, { name, port }]) => ({ name, port, url: expectedTunnelUrls[tunnel] }))

    return { hostKey: hk, expectedServiceUrls: esu }
  }, { opPrefix: 'Tunnel server', successText: 'Got tunnel server details' })

  log.debug('expectedServiceUrls: %j', expectedServiceUrls)

  return { expectedServiceUrls, hostKey }
}

// eslint-disable-next-line no-use-before-define
export default class Up extends MachineCreationDriverCommand<typeof Up> {
  static description = 'Bring up a preview environment'

  static flags = {
    ...envIdFlags,
    ...tunnelServerFlags,
    ...buildFlags,
    'skip-volume': Flags.string({
      description: 'Additional volume glob patterns to skip copying',
      multiple: true,
      singleValue: true,
      default: [],
    }),
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
    ...tableFlags,
  }

  static strict = false

  static args = {
    service: Args.string({
      description: 'Service name(s). If not specified, will deploy all services',
      required: false,
    }),
  }

  async run(): Promise<unknown> {
    const { flags, rawArgs: restArgs } = this

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
    const pStoreRef = pStore.ref
    const tunnelingKey = await withSpinner(
      () => pStoreRef.tunnelingKey(),
      { text: 'Getting tunneling key from profile...', successText: 'Got tunneling key from profile' },
    )
    const thumbprint = await jwkThumbprint(tunnelingKey)

    const tunnelOpts = {
      url: flags['tunnel-url'],
      tlsServerName: flags['tls-hostname'],
      insecureSkipVerify: flags['insecure-skip-verify'],
    }

    const { expectedServiceUrls, hostKey } = await fetchTunnelServerDetails({
      log: this.logger,
      tunnelingKey,
      envId,
      userModel,
      pStore,
      tunnelOpts,
    })

    const injectWidgetScript = flags['enable-widget']
      ? editUrl(flags['livecycle-widget-url'], { queryParams: { profile: thumbprint, env: envId } }).toString()
      : undefined

    await using cleanup = new AsyncDisposableStack()

    const { machine, connection, userAndGroup, dockerPlatform } = await ensureMachine({
      log: this.logger,
      debug: this.flags.debug,
      machineDriver: driver,
      machineCreationDriver,
      machineDriverName: this.driverName,
      envId,
    })

    const machineStatusCommand = await driver.machineStatusCommand(machine)

    cleanup.use(connection)

    const buildSpec = parseBuildFlags(flags)

    await commands.up({
      connection,
      machineStatusCommand,
      userAndGroup,
      dockerPlatform,
      projectName,
      expectedServiceUrls,
      userSpecifiedServices: restArgs,
      volumeSkipList: [...defaultVolumeSkipList, ...flags['skip-volume']],
      debug: flags.debug,
      userSpecifiedProjectName: flags.project,
      composeFiles: this.config.composeFiles,
      modelFilter: this.modelFilter,
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
      buildSpec,
    })

    this.log(`Preview environment ${text.code(envId)} provisioned at: ${text.code(machine.locationDescription)}`)

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
