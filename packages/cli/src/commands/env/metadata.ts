import { Flags, ux } from '@oclif/core'
import { envIdFlags, parseTunnelServerFlags, text, tunnelServerFlags } from '@preevy/cli-common'
import { TunnelOpts, addBaseComposeTunnelAgentService, findComposeTunnelAgentUrl, findEnvId, getTunnelNamesToServicePorts, getUserCredentials, jwtGenerator, profileStore, queryEnvMetadata, readMetadata } from '@preevy/core'
import { tunnelNameResolver } from '@preevy/common'
import { inspect } from 'util'
import DriverCommand from '../../driver-command.js'
import { connectToTunnelServerSsh } from '../../tunnel-server-client.js'

type MetadataSource = 'agent' | 'driver'
type UnknownMetadata = Record<string, unknown>


export default class EnvMetadataCommand extends DriverCommand<typeof EnvMetadataCommand> {
  static description = 'Show metadata for a preview environment'
  static enableJsonFlag = true

  static flags = {
    ...envIdFlags,
    ...tunnelServerFlags,
    source: Flags.custom<'driver' | 'agent'>({
      summary: 'Show metadata from the driver, the agent, or the driver if the agent is not available',
      default: ['agent', 'driver'],
      multiple: true,
      delimiter: ',',
      multipleNonGreedy: true,
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

    return await queryEnvMetadata({
      composeTunnelServiceUrl,
      credentials,
      fetchTimeout: this.flags['fetch-timeout'],
      retryOpts: { retries: 2 },
    })
  }

  metadataFactories: Record<MetadataSource, () => Promise<UnknownMetadata>> = {
    driver: this.getMetadataFromDriver.bind(this),
    agent: this.getMetadataFromAgent.bind(this),
  }

  async getMetatdata() {
    const { flags: { source: sources } } = this
    const errors: { source: MetadataSource; error: unknown }[] = []
    for (const source of sources) {
      try {
        this.logger.debug(`Fetching metadata from ${source}`)
        return {

          metadata: await this.metadataFactories[source](),
          errors,
          source,
        }
      } catch (err) {
        errors.push({ source, error: err })
      }
    }

    return { errors }
  }

  async run(): Promise<unknown> {
    const { metadata, source: metadataSource, errors } = await this.getMetatdata()

    if (!metadata) {
      throw new Error(`Could not get metadata: ${inspect(errors)}`)
    }

    if (errors.length) {
      for (const { source: errorSource, error } of errors) {
        this.logger.warn(`Error fetching metadata from ${errorSource}: ${error}`)
      }
    }

    if (this.jsonEnabled()) {
      return { ...metadata, _source: metadataSource }
    }

    this.logger.info(`Metadata from ${text.code(metadataSource)}`)
    this.logger.info(inspect(metadata, { depth: null, colors: text.supportsColor !== false }))
    return undefined
  }
}
