import { Flags } from '@oclif/core'
import DriverCommand from '../../driver-command'
import { localComposeClient } from '../../lib/compose/client'
import { composeFlags } from '../../lib/compose/flags'
import { envIdFlags, findAmbientEnvId, findAmbientProjectName } from '../../lib/env-id'
import { Logger } from '../../log'

const findEnvId = async (log: Logger, { project, file }: { project?: string; file: string[] }) => {
  const projectName = project || await findAmbientProjectName(localComposeClient(file))
  log.debug(`project: ${projectName}`)
  return findAmbientEnvId(projectName)
}

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
  }

  static args = {
  }

  static enableJsonFlag = true

  async run(): Promise<unknown> {
    const log = this.logger
    const { flags } = await this.parse(Down)
    const driver = await this.driver()
    const envId = flags.id ?? await findEnvId(log, flags)

    log.debug(`envId: ${envId}`)

    const machine = await driver.getMachine({ envId })

    if (!machine) {
      if (!flags.force) {
        throw new Error(`No machine found for envId ${envId}`)
      }
      return undefined
    }

    await driver.removeMachine(machine.providerId)

    if (flags.json) {
      return envId
    }

    this.log(envId)
    return undefined
  }
}
