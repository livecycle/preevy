import yaml from 'yaml'
import { Args, Flags, Interfaces } from '@oclif/core'
import {
  addBaseComposeTunnelAgentService,
  localComposeClient, findEnvId, MachineConnection, ComposeModel, remoteUserModel, dockerEnvContext,
} from '@preevy/core'
import { COMPOSE_TUNNEL_AGENT_SERVICE_NAME } from '@preevy/common'
import { argsFromRaw } from '@preevy/cli-common'
import DriverCommand from '../driver-command'
import { envIdFlags } from '../common-flags'

const validateServices = (
  specifiedServices: string[],
  userModel: Pick<ComposeModel, 'services'>,
) => {
  // exclude compose tunnel agent service unless explicitly specified
  const modelServices = Object.keys(userModel.services ?? {})

  const services = specifiedServices.length ? specifiedServices : modelServices

  for (const service of services) {
    if (service !== COMPOSE_TUNNEL_AGENT_SERVICE_NAME && !modelServices.includes(service)) {
      throw new Error(`Specified service ${service} not found. Available services: ${modelServices.join(', ')}`)
    }
  }

  return services
}

const dockerComposeLogsFlags = {
  follow: Flags.boolean({
    description: 'Follow log output',
  }),
  tail: Flags.integer({
    description: 'Number of lines to show from the end of the logs for each container (default: all)',
  }),
  'no-log-prefix': Flags.boolean({
    description: 'Don\'t print log prefix in logs',
  }),
  timestamps: Flags.boolean({
    description: 'Show timestamps',
  }),
  since: Flags.string({
    description: 'Show logs since timestamp',
  }),
  until: Flags.string({
    description: 'Show logs before timestamp',
  }),
} as const

const serializeDockerComposeLogsFlags = (
  flags: Omit<Interfaces.InferredFlags<typeof dockerComposeLogsFlags>, 'json'>
) => [
  ...flags.follow ? ['--follow'] : [],
  ...flags.tail ? ['--tail', flags.tail.toString()] : [],
  ...flags.until ? ['--until', flags.until] : [],
  ...flags.since ? ['--since', flags.since] : [],
  ...flags.timestamps ? ['--timestamps'] : [],
  ...flags['no-log-prefix'] ? ['--no-log-prefix'] : [],
]

// eslint-disable-next-line no-use-before-define
export default class Logs extends DriverCommand<typeof Logs> {
  static description = 'Show logs for an existing environment'

  static flags = {
    ...envIdFlags,
    ...dockerComposeLogsFlags,
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
    const restArgs = argsFromRaw(raw)

    let connection: MachineConnection
    let userModel: ComposeModel
    if (flags.id) {
      connection = await this.connect(flags.id)
      userModel = await remoteUserModel(connection)
    } else {
      userModel = await this.ensureUserModel()
      const envId = await findEnvId({
        log,
        userSpecifiedEnvId: undefined,
        userSpecifiedProjectName: flags.project,
        userModel,
      })
      connection = await this.connect(envId)
    }

    const compose = localComposeClient({
      composeFiles: Buffer.from(yaml.stringify(addBaseComposeTunnelAgentService(userModel))),
      projectName: flags.project,
      projectDirectory: process.cwd(),
    })

    await using dockerContext = await dockerEnvContext({ connection, log })

    await compose.spawnPromise(
      [
        'logs',
        ...serializeDockerComposeLogsFlags(flags),
        ...validateServices(restArgs, userModel),
      ],
      { stdio: 'inherit', env: dockerContext.env },
    )
  }
}
