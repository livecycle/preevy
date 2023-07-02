import { Args, Flags, ux } from '@oclif/core'
import {
  commands, flattenTunnels, profileStore,
  telemetryEmitter,
} from '@preevy/core'
import { asyncReduce } from 'iter-tools-es'
import { tunnelServerFlags } from '@preevy/cli-common'
import { tunnelServerHello } from '../tunnel-server-client'
import MachineCreationDriverCommand from '../machine-creation-driver-command'
import { envIdFlags } from '../common-flags'

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

    const { hostKey, clientId, rootUrl } = await tunnelServerHello({
      tunnelingKey,
      knownServerPublicKeys: pStore.knownServerPublicKeys,
      tunnelOpts,
      log: this.logger,
    })

    telemetryEmitter().group({ type: 'profile' }, { proxy_client_id: clientId })

    const userModel = await this.ensureUserModel()

    const { machine, tunnels, envId } = await commands.up({
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

    const flatTunnels = flattenTunnels(tunnels)

    const result = await asyncReduce(
      { urls: flatTunnels },
      async ({ urls }, envCreated) => await envCreated(
        { log: this.logger, userModel },
        { envId, urls },
      ),
      this.config.preevyHooks.envCreated,
    )

    if (flags.json) {
      return result.urls
    }

    this.log(`Preview environment ${envId} provisioned at ${machine.locationDescription}`)

    ux.table(
      result.urls,
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
