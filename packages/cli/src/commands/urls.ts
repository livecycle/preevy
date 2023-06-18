import { Args, ux } from '@oclif/core'
import { commands, findAmbientEnvId, profileStore } from '@preevy/core'
import { tunnelServerFlags } from '@preevy/cli-common'
import { tunnelServerHello } from '../tunnel-server-client'
import ProfileCommand from '../profile-command'
import { envIdFlags } from '../common-flags'

// eslint-disable-next-line no-use-before-define
export default class Urls extends ProfileCommand<typeof Urls> {
  static description = 'Show urls for an existing environment'

  static flags = {
    ...envIdFlags,
    ...tunnelServerFlags,
    ...ux.table.flags(),
  }

  static enableJsonFlag = true

  static args = {
    service: Args.string({
      description: 'Service name. If not specified, will show all services',
      required: false,
    }),
    port: Args.integer({
      description: 'Service port. If not specified, will show all ports for the specified service',
      required: false,
    }),
  }

  async run(): Promise<unknown> {
    const log = this.logger
    const { flags, args } = await this.parse(Urls)
    const projectName = (await this.ensureUserModel()).name
    log.debug(`project: ${projectName}`)
    const envId = flags.id || await findAmbientEnvId(projectName)
    log.debug(`envId: ${envId}`)

    const pStore = profileStore(this.store)

    const tunnelOpts = {
      url: flags['tunnel-url'],
      tlsServerName: flags['tls-hostname'],
      insecureSkipVerify: flags['insecure-skip-verify'],
    }

    const { clientId, baseUrl } = await tunnelServerHello({
      tunnelOpts,
      knownServerPublicKeys: pStore.knownServerPublicKeys,
      tunnelingKey: await pStore.getTunnelingKey(),
      log: this.logger,
    })

    const flatTunnels = await commands.urls({
      baseUrl,
      clientId,
      envId,
      projectName,
      serviceAndPort: args.service ? { service: args.service, port: args.port } : undefined,
    })

    if (flags.json) {
      return flatTunnels
    }

    ux.table(
      flatTunnels,
      {
        service: { header: 'Service' },
        port: { header: 'Port' },
        url: { header: 'URL' },
      },
      flags,
    )

    return undefined
  }
}
