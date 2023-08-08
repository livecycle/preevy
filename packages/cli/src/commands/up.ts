import { Args, Flags, ux } from '@oclif/core'
import {
  commands, profileStore,
  telemetryEmitter,
} from '@preevy/core'
import { tunnelServerFlags } from '@preevy/cli-common'
import { inspect } from 'util'
import { withSpinner } from '@preevy/core/src/spinner'
import { tunnelServerHello } from '../tunnel-server-client'
import MachineCreationDriverCommand from '../machine-creation-driver-command'
import { envIdFlags, urlFlags } from '../common-flags'
import { filterUrls, printUrls } from './urls'

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
    const pStore = profileStore(this.store)

    const tunnelingKey = await pStore.getTunnelingKey()

    const tunnelOpts = {
      url: flags['tunnel-url'],
      tlsServerName: flags['tls-hostname'],
      insecureSkipVerify: flags['insecure-skip-verify'],
    }

    const { clientId, rootUrl, hostKey } = await withSpinner(async spinner => {
      spinner.text = 'Getting tunnel server details...'
      return await tunnelServerHello({
        tunnelingKey,
        knownServerPublicKeys: pStore.knownServerPublicKeys,
        tunnelOpts,
        log: this.logger,
      })
    })

    telemetryEmitter().group({ type: 'profile' }, { proxy_client_id: clientId })

    const userModel = await this.ensureUserModel()

    const { machine, envId } = await commands.up({
      clientId,
      rootUrl,
      userSpecifiedServices: restArgs,
      debug: flags.debug,
      machineDriver: driver,
      machineCreationDriver,
      userModel,
      userSpecifiedProjectName: flags.project,
      userSpecifiedEnvId: flags.id,
      userSpecifiedComposeFiles: flags.file,
      systemComposeFiles: flags['system-compose-file'],
      tunnelOpts,
      log: this.logger,
      dataDir: this.config.dataDir,
      sshTunnelPrivateKey: tunnelingKey,
      allowedSshHostKeys: hostKey,
      cwd: process.cwd(),
      skipUnchangedFiles: flags['skip-unchanged-files'],
    })

    this.log(`Preview environment ${envId} provisioned at: ${machine.locationDescription}`)

    const flatTunnels = await withSpinner(async spinner => {
      spinner.text = 'Getting tunnel URLs...'
      return await commands.urls({
        rootUrl,
        clientId,
        envId,
        tunnelingKey,
        includeAccessCredentials: flags['include-access-credentials'],
        showPreevyService: flags['show-preevy-service-urls'],
        retryOpts: {
          minTimeout: 1000,
          maxTimeout: 2000,
          retries: 10,
          onFailedAttempt: e => { this.logger.debug(`Failed to query tunnels: ${inspect(e)}`) },
        },
      })
    })

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
