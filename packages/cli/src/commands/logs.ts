import yaml from 'yaml'
import { Args, ux } from '@oclif/core'
import DriverCommand from '../driver-command'
import { sshKeysStore } from '../lib/state/ssh'
import { connectSshClient as createSshClient } from '../lib/ssh/client'
import { envIdFlags, findAmbientEnvId, findAmbientProjectName } from '../lib/env-id'
import { addBaseDockerProxyService } from '../lib/docker-proxy-client'
import { localComposeClient } from '../lib/compose/client'
import { composeFlags } from '../lib/compose/flags'
import { wrapWithDockerSocket } from '../lib/commands/up/docker'

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
    const driver = await this.machineDriver()
    const keyAlias = await driver.getKeyPairAlias()

    const keyStore = sshKeysStore(this.store)
    const sshKey = await keyStore.getKey(keyAlias)
    if (!sshKey) {
      throw new Error(`No key pair found for alias ${keyAlias}`)
    }

    const projectName = flags.project || await findAmbientProjectName(localComposeClient(flags.file))
    log.debug(`project: ${projectName}`)
    const envId = flags.id || await findAmbientEnvId(projectName)
    log.debug(`envId: ${envId}`)

    const machine = await driver.getMachine({ envId })
    if (!machine) {
      throw new Error(`No machine found for envId ${envId}`)
    }

    const model = await localComposeClient(flags.file).getModel()

    const sshClient = await createSshClient({
      debug: flags.debug,
      host: machine.publicIPAddress,
      username: machine.sshUsername,
      privateKey: sshKey.privateKey.toString('utf-8'),
      log,
    })

    try {
      const compose = localComposeClient(Buffer.from(yaml.stringify(addBaseDockerProxyService(model))))
      const withDockerSocket = wrapWithDockerSocket({ sshClient, log })

      // exclude docker proxy service unless explicitly specified
      const services = restArgs.length ? restArgs : Object.keys(model.services ?? {})

      await withDockerSocket(() => compose.spawnPromise(['logs', ...services], { stdio: 'inherit' }))
    } finally {
      sshClient.dispose()
    }
  }
}
