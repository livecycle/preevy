import { Flags, ux } from '@oclif/core'
import { envIdFlags, parseTunnelServerFlags, tableFlags, text, tunnelServerFlags, urlFlags } from '@preevy/cli-common'
import { AgentFetchError, TunnelOpts, addBaseComposeTunnelAgentService, findComposeTunnelAgentUrl, findEnvId, getTunnelNamesToServicePorts, getUserCredentials, jwtGenerator, profileStore, queryEnvMetadata, readMetadata } from '@preevy/core'
import { tunnelNameResolver } from '@preevy/common'
import { inspect } from 'util'
import DriverCommand from '../../driver-command.js'
import { connectToTunnelServerSsh } from '../../tunnel-server-client.js'

// eslint-disable-next-line no-use-before-define
export default class EnvMetadataCommand extends DriverCommand<typeof EnvMetadataCommand> {
  static description = 'Show metadata for a preview environment'
  static enableJsonFlag = true

  static flags = {
    ...envIdFlags,
    ...tunnelServerFlags,
    from: Flags.custom<'driver' | 'agent' | 'agent-or-driver'>({
      summary: 'Show metadata from the driver, the agent, or the driver if the agent is not available',
      default: 'agent-or-driver',
    })(),
    'fetch-timeout': Flags.integer({
      default: 2500,
      summary: 'Timeout for fetching metadata from the agent in milliseconds',
    }),
  } as const

  async getComposeTunnelAgentUrl(
    envId: string,
    tunnelOpts: TunnelOpts,
    tunnelingKey: string | Buffer,
  ) {
    const expectedTunnels = getTunnelNamesToServicePorts(
      addBaseComposeTunnelAgentService({ name: '' }),
      tunnelNameResolver({ envId }),
    )

    const { client: tunnelServerSshClient } = await connectToTunnelServerSsh({
      tunnelOpts,
      profileStore: profileStore(this.store),
      tunnelingKey,
      log: this.logger,
    })

    try {
      const expectedTunnelUrls = await tunnelServerSshClient.execTunnelUrl(Object.keys(expectedTunnels))

      const expectedServiceUrls = Object.entries(expectedTunnels)
        .map(([tunnel, { name, port }]) => ({ name, port, url: expectedTunnelUrls[tunnel] }))

      return findComposeTunnelAgentUrl(expectedServiceUrls)
    } finally {
      void tunnelServerSshClient.end()
    }
  }

  #envId: string | undefined
  async envId() {
    if (!this.#envId) {
      const { flags } = this
      this.#envId = await findEnvId({
        userSpecifiedEnvId: flags.id,
        userSpecifiedProjectName: flags.project,
        userModel: () => this.ensureUserModel(),
        log: this.logger,
      })
    }
    return this.#envId
  }

  async getMetadataFromDriver() {
    return await this.withConnection(await this.envId(), readMetadata)
  }

  async getMetadataFromAgent() {
    const pStore = profileStore(this.store).ref
    const tunnelingKey = await pStore.tunnelingKey()
    const composeTunnelServiceUrl = await this.getComposeTunnelAgentUrl(
      await this.envId(),
      parseTunnelServerFlags(this.flags),
      tunnelingKey,
    )
    const credentials = await getUserCredentials(jwtGenerator(tunnelingKey))
    try {
      // eslint-disable-next-line @typescript-eslint/return-await
      return await queryEnvMetadata({
        composeTunnelServiceUrl,
        credentials,
        fetchTimeout: this.flags['fetch-timeout'],
        retryOpts: { retries: 2 },
      })
    } catch (err) {
      this.logger.debug('Failed to fetch metadata from agent', inspect(err))
      if (!(err instanceof AgentFetchError)) {
        throw err
      }
      return undefined
    }
  }

  async getMetatdata() {
    const { flags: { from } } = this
    if (from === 'agent' || from === 'agent-or-driver') {
      const metadata = await this.getMetadataFromAgent()
      if (metadata) {
        return {
          metadata,
          source: 'agent',
        }
      }
    }

    if ((from === 'driver' || from === 'agent-or-driver')) {
      const metadata = await this.getMetadataFromDriver()
      if (metadata) {
        return {
          metadata,
          source: 'driver',
        }
      }
    }

    return undefined
  }

  async run(): Promise<unknown> {
    const result = await this.getMetatdata()
    if (!result) {
      throw new Error('Could not get metadata. See debug logs for more information')
    }

    if (this.jsonEnabled()) {
      return { ...result.metadata, _source: result.source }
    }

    ux.info(`Metadata from ${text.code(result.source)}`)
    ux.styledObject(result.metadata)
    return undefined
  }
}
