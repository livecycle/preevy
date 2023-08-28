import { Args, Flags, ux } from '@oclif/core'
import {
  addBaseComposeTunnelAgentService,
  commands, findComposeTunnelAgentUrl,
  findEnvId, findProjectName, getTunnelNamesToServicePorts, profileStore,
  telemetryEmitter,
  withSpinner,
} from '@preevy/core'
import { tunnelServerFlags } from '@preevy/cli-common'
import { inspect } from 'util'
import { tunnelNameResolver } from '@preevy/common'
import MachineCreationDriverCommand from '../machine-creation-driver-command'
import { envIdFlags, urlFlags } from '../common-flags'
import { filterUrls, printUrls } from './urls'
import { connectToTunnelServerSsh } from '../tunnel-server-client'

// eslint-disable-next-line no-use-before-define
export default class Up extends MachineCreationDriverCommand<typeof Up> {
  static description = 'Bring up a preview environment'

  static flags = {
    ...envIdFlags,
    ...tunnelServerFlags,
    'skip-unchanged-files': Flags.boolean({
      description: 'Detect and skip unchanged files when copying (default: true)',
      default: true,
      allowNo: true,
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
    const restArgs = raw.filter(arg => arg.type === 'arg').map(arg => arg.input)

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

      tunnelServerSshClient.close()

      telemetryEmitter().group({ type: 'profile' }, { proxy_client_id: clientId })

      const esu = Object.entries(expectedTunnels)
        .map(([tunnel, { name, port }]) => ({ name, port, url: expectedTunnelUrls[tunnel] }))

      return { hostKey: hk, expectedServiceUrls: esu }
    }, { opPrefix: 'Tunnel server', successText: 'Got tunnel server details' })

    this.logger.debug('expectedServiceUrls: %j', expectedServiceUrls)

    const { machine } = await commands.up({
      projectName,
      expectedServiceUrls,
      userSpecifiedServices: restArgs,
      debug: flags.debug,
      machineDriver: driver,
      machineDriverName: this.driverName,
      machineCreationDriver,
      userSpecifiedProjectName: flags.project,
      userSpecifiedComposeFiles: flags.file,
      envId,
      systemComposeFiles: flags['system-compose-file'],
      tunnelOpts,
      log: this.logger,
      dataDir: this.config.dataDir,
      sshTunnelPrivateKey: tunnelingKey,
      allowedSshHostKeys: hostKey,
      cwd: process.cwd(),
      skipUnchangedFiles: flags['skip-unchanged-files'],
      version: this.config.version,
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

    if (flags.json) {
      return urls
    }

    printUrls(urls, flags)

    return undefined
  }
}
