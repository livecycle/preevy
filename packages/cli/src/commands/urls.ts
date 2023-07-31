import { Args, ux, Interfaces } from '@oclif/core'
import { FlatTunnel, commands, findAmbientEnvId, profileStore } from '@preevy/core'
import { HooksListeners, PluginContext, tunnelServerFlags } from '@preevy/cli-common'
import { asyncReduce } from 'iter-tools-es'
import { tunnelServerHello } from '../tunnel-server-client'
import ProfileCommand from '../profile-command'
import { envIdFlags, urlFlags } from '../common-flags'

export const printUrls = (
  flatTunnels: FlatTunnel[],
  flags: Interfaces.InferredFlags<typeof ux.table.Flags> & { 'include-access-credentials': boolean },
) => {
  ux.table(
    flatTunnels,
    {
      service: { header: 'Service' },
      port: { header: 'Port' },
      url: { header: 'URL' },
    },
    {
      ...flags,
      'no-truncate': flags['no-truncate'] ?? (!flags.output && !flags.csv && flags['include-access-credentials']),
      'no-header': flags['no-header'] ?? (!flags.output && !flags.csv && flags['include-access-credentials']),
    },
  )
}

export const filterUrls = ({ flatTunnels, context, filters }: {
  flatTunnels: FlatTunnel[]
  context: PluginContext
  filters: HooksListeners['filterUrls']
}) => asyncReduce(
  flatTunnels,
  (urls, f) => f(context, urls),
  filters,
)

// eslint-disable-next-line no-use-before-define
export default class Urls extends ProfileCommand<typeof Urls> {
  static description = 'Show urls for an existing environment'

  static flags = {
    ...envIdFlags,
    ...tunnelServerFlags,
    ...ux.table.flags(),
    ...urlFlags,
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
    const envId = flags.id || await findAmbientEnvId((await this.ensureUserModel()).name)
    log.debug(`envId: ${envId}`)

    const pStore = profileStore(this.store)

    const tunnelOpts = {
      url: flags['tunnel-url'],
      tlsServerName: flags['tls-hostname'],
      insecureSkipVerify: flags['insecure-skip-verify'],
    }

    const tunnelingKey = await pStore.getTunnelingKey()
    const { clientId, rootUrl } = await tunnelServerHello({
      tunnelOpts,
      knownServerPublicKeys: pStore.knownServerPublicKeys,
      tunnelingKey,
      log: this.logger,
    })

    const flatTunnels = await commands.urls({
      rootUrl,
      clientId,
      envId,
      serviceAndPort: args.service ? { service: args.service, port: args.port } : undefined,
      tunnelingKey,
      includeAccessCredentials: flags['include-access-credentials'],
      retryOpts: { retries: 2 },
    })

    const urls = await filterUrls({
      flatTunnels,
      context: {
        log: this.logger,
        userModel: { name: '' }, // TODO: don't want to require a compose file for this command
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
