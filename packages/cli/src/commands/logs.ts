import yaml from 'yaml'
import { Args, ux } from '@oclif/core'
import {
  isPartialMachine,
  COMPOSE_TUNNEL_AGENT_SERVICE_NAME, addBaseComposeTunnelAgentService,
  findAmbientEnvId, localComposeClient, wrapWithDockerSocket,
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

    const projectName = (await this.ensureUserModel()).name
    log.debug(`project: ${projectName}`)
    const envId = flags.id || await findAmbientEnvId(projectName)
    log.debug(`envId: ${envId}`)

    const model = await this.ensureUserModel()

    // exclude docker proxy service unless explicitly specified
    const modelServices = Object.keys(model.services ?? {})

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
      const withDockerSocket = wrapWithDockerSocket({ connection, log })

      const compose = localComposeClient(
        { composeFiles: Buffer.from(yaml.stringify(addBaseComposeTunnelAgentService(model))), projectName }
      )

      await withDockerSocket(() => compose.spawnPromise(['logs', ...services], { stdio: 'inherit' }))
    } finally {
      await connection.close()
    }
  }
}
