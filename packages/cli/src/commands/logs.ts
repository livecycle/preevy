import yaml from 'yaml'
import { Args, ux } from '@oclif/core'
import {
  isPartialMachine,
  COMPOSE_TUNNEL_AGENT_SERVICE_NAME, addBaseComposeTunnelAgentService,
  localComposeClient, wrapWithDockerSocket, findEnvId,
} from '@preevy/core'
import DriverCommand from '../driver-command'
import { envIdFlags } from '../common-flags'

// eslint-disable-next-line no-use-before-define
export default class Logs extends DriverCommand<typeof Logs> {
  static description = 'Show logs for an existing environment'

  static flags = {
    ...envIdFlags,
    ...ux.table.flags(),
  }

  static strict = false

  static enableJsonFlag = false

  static args = {
    services: Args.string({
      description: 'Service name(s). If not specified, will show all services',
    }),
  }

  async run(): Promise<void> {
    const log = this.logger
    const { flags, raw } = await this.parse(Logs)
    const restArgs = raw.filter(arg => arg.type === 'arg').map(arg => arg.input)
    const driver = await this.driver()
    const userModel = await this.ensureUserModel()

    const { envId } = await findEnvId({
      userSpecifiedEnvId: flags.id,
      userSpecifiedProjectName: flags.project,
      userModel,
      log: log.debug,
    })

    // exclude docker proxy service unless explicitly specified
    const modelServices = Object.keys(userModel.services ?? {})

    const services = restArgs.length ? restArgs : modelServices

    for (const service of services) {
      if (service !== COMPOSE_TUNNEL_AGENT_SERVICE_NAME && !modelServices.includes(service)) {
        throw new Error(`Specified service ${service} not found. Available services: ${modelServices.join(', ')}`)
      }
    }

    const machine = await driver.getMachine({ envId })
    if (!machine || isPartialMachine(machine)) {
      throw new Error(`No machine found for envId ${envId}`)
    }

    const connection = await driver.connect(machine, { log, debug: flags.debug })

    try {
      const compose = localComposeClient({
        composeFiles: Buffer.from(yaml.stringify(addBaseComposeTunnelAgentService(userModel))),
        projectName: flags.project,
      })

      const withDockerSocket = wrapWithDockerSocket({ connection, log })
      await withDockerSocket(() => compose.spawnPromise(['logs', ...services], { stdio: 'inherit' }))
    } finally {
      await connection.close()
    }
  }
}
