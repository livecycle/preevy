import { ux, Args } from '@oclif/core'
import { tunnelServerFlags, urlFlags } from '@preevy/cli-common'
import { commands, profileStore, SshConnection } from '@preevy/core'
import { connectToTunnelServerSsh } from '../../tunnel-server-client'
import ProfileCommand from '../../profile-command'
import { filterUrls, printUrls } from '../urls'

// eslint-disable-next-line no-use-before-define
export default class Urls extends ProfileCommand<typeof Urls> {
  static description = 'Show urls for tunneled local compose application'

  static flags = {
    ...tunnelServerFlags,
    ...urlFlags,
    ...ux.table.flags(),
  }

  static strict = false
  static hidden = true

  static args = {
    'compose-project': Args.string({
      description: 'Compose Project name',
      required: true,
    }),
  }

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

    const composeInspector = commands.proxy.inspectRunningComposeApp(args['compose-project'])
    const envId = await composeInspector.getEnvId()
    if (!envId) {
      throw new Error('Proxy not running, use preevy proxy connect <compose-project>')
    }

    let client: SshConnection['client'] | undefined
    let preevyAgentUrl: string | undefined
    try {
      client = (await connectToTunnelServerSsh({
        tunnelOpts,
        knownServerPublicKeys: pStore.knownServerPublicKeys,
        tunnelingKey,
        log: this.logger,
      })).client
      preevyAgentUrl = await commands.proxy.getPreevyAgentUrl(client, envId)
    } finally {
      client?.close()
    }

    const flatTunnels = await commands.urls({
      composeTunnelServiceUrl: preevyAgentUrl,
      tunnelingKey,
      includeAccessCredentials: flags['include-access-credentials'],
      showPreevyService: flags['show-preevy-service-urls'],
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
