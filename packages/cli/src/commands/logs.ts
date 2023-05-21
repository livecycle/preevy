import yaml from 'yaml'
import { Args, ux } from '@oclif/core'
import {
  sshKeysStore, connectSshClient as createSshClient,
  COMPOSE_TUNNEL_AGENT_SERVICE_NAME, addBaseComposeTunnelAgentService,
  findAmbientEnvId, localComposeClient, wrapWithDockerSocket,
} from '@preevy/core'
import DriverCommand from '../driver-command'
import { envIdFlags, composeFlags } from '../common-flags'

// eslint-disable-next-line no-use-before-define
export default class Logs extends DriverCommand<typeof Logs> {
  static description = 'Show logs for an existing environment'

  static flags = {
    ...envIdFlags,
    ...composeFlags,
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
    const keyAlias = await driver.getKeyPairAlias()

    const keyStore = sshKeysStore(this.store)
    const sshKey = await keyStore.getKey(keyAlias)
    if (!sshKey) {
      throw new Error(`No key pair found for alias ${keyAlias}`)
    }

    const projectName = (await this.ensureUserModel()).name
    log.debug(`project: ${projectName}`)
    const envId = flags.id || await findAmbientEnvId(projectName)
    log.debug(`envId: ${envId}`)

    const model = await localComposeClient({ composeFiles: flags.file, projectName }).getModel()

    // exclude docker proxy service unless explicitly specified
    const modelServices = Object.keys(model.services ?? {})

    const services = restArgs.length ? restArgs : modelServices

    for (const service of services) {
      if (service !== COMPOSE_TUNNEL_AGENT_SERVICE_NAME && !modelServices.includes(service)) {
        throw new Error(`Specified service ${service} not found. Available services: ${modelServices.join(', ')}`)
      }
    }

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
      const withDockerSocket = wrapWithDockerSocket({ sshClient, log })

      const compose = localComposeClient(
        { composeFiles: Buffer.from(yaml.stringify(addBaseComposeTunnelAgentService(model))), projectName }
      )

      await withDockerSocket(() => compose.spawnPromise(['logs', ...services], { stdio: 'inherit' }))
    } finally {
      sshClient.dispose()
    }
  }
}
