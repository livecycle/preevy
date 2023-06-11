import { Args, ux } from '@oclif/core'
import { commands, findAmbientEnvId } from '@preevy/core'
import DriverCommand from '../driver-command'
import { envIdFlags } from '../common-flags'

// eslint-disable-next-line no-use-before-define
export default class Urls extends DriverCommand<typeof Urls> {
  static description = 'Show urls for an existing environment'

  static flags = {
    ...envIdFlags,
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

    const flatTunnels = await commands.urls({
      log,
      envId,
      projectName,
      driver: await this.driver(),
      debug: flags.debug,
      store: this.store,
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
