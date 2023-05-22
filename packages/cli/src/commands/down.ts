import { Flags } from '@oclif/core'
import { findAmbientEnvId, withSpinner } from '@preevy/core'
import DriverCommand from '../driver-command'
import { envIdFlags, composeFlags } from '../common-flags'

// eslint-disable-next-line no-use-before-define
export default class Down extends DriverCommand<typeof Down> {
  static description = 'Delete preview environments'

  static flags = {
    ...envIdFlags,
    ...composeFlags,
    force: Flags.boolean({
      description: 'Do not error if the environment is not found',
      default: false,
    }),
    wait: Flags.boolean({
      description: 'Wait for resource deletion to complete. If false (the default), the deletion will be started but not waited for',
      default: false,
    }),
  }

  static args = {
  }

  static enableJsonFlag = true

  async run(): Promise<unknown> {
    const log = this.logger
    const { flags } = await this.parse(Down)
    const driver = await this.driver()
    const userModel = await this.ensureUserModel()
    const projectName = userModel.name
    log.debug(`project: ${projectName}`)
    const envId = flags.id ?? await findAmbientEnvId(projectName)

    log.debug(`envId: ${envId}`)

    const machine = await driver.getMachine({ envId })

    if (!machine) {
      if (!flags.force) {
        throw new Error(`No machine found for environment ${envId}`)
      }
      return undefined
    }

    await withSpinner(async () => {
      await driver.removeMachine(machine.providerId, flags.wait)
    }, { opPrefix: `Deleting ${driver.friendlyName} machine ${machine.providerId} for environment ${envId}` })

    await Promise.all(
      this.config.preevyHooks.envDeleted.map(envDeleted => envDeleted(
        { log: this.logger, userModel },
        { envId },
      )),
    )

    if (flags.json) {
      return envId
    }

    this.log(envId)
    return undefined
  }
}
