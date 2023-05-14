import { Args, ux } from '@oclif/core'
import {
  sshKeysStore,
  connectSshClient as createSshClient,
  FlatTunnel, composeFlags, envIdFlags, findAmbientEnvId,
  findAmbientProjectName, flattenTunnels, localComposeClient, queryTunnels,
} from '@preevy/core'
import DriverCommand from '../driver-command'

// eslint-disable-next-line no-use-before-define
export default class Urls extends DriverCommand<typeof Urls> {
  static description = 'Show urls for an existing environment'

  static flags = {
    ...envIdFlags,
    ...composeFlags,
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
    const driver = await this.driver()
    const keyAlias = await driver.getKeyPairAlias()

    const keyStore = sshKeysStore(this.store)
    const sshKey = await keyStore.getKey(keyAlias)
    if (!sshKey) {
      throw new Error(`No key pair found for alias ${keyAlias}`)
    }

    const projectName = flags.project || await findAmbientProjectName(localComposeClient({ composeFiles: flags.file }))
    log.debug(`project: ${projectName}`)
    const envId = flags.id || await findAmbientEnvId(projectName)
    log.debug(`envId: ${envId}`)

    const machine = await driver.getMachine({ envId })
    if (!machine) {
      throw new Error(`No machine found for envId ${envId}`)
    }

    const sshClient = await createSshClient({
      debug: flags.debug,
      host: machine.publicIPAddress,
      username: machine.sshUsername,
      privateKey: sshKey.privateKey.toString('utf-8'),
      log,
    })

    try {
      const { tunnels } = await queryTunnels({ sshClient, projectName, retryOpts: { retries: 2 } })

      const flatTunnels: FlatTunnel[] = flattenTunnels(tunnels)
        .filter(tunnel => !args.service || (
          tunnel.service === args.service && (!args.port || tunnel.port === args.port)
        ))

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
        this.flags,
      )

      return undefined
    } finally {
      sshClient.dispose()
    }
  }
}
