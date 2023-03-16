import { Flags } from '@oclif/core'
import DriverCommand from '../../driver-command'
import { localComposeClient } from '../../lib/compose/client'
import { composeFlags } from '../../lib/compose/flags'
import { envIdFlags, findAmbientEnvId, findAmbientProjectName } from '../../lib/env-id'

export default class Down extends DriverCommand<typeof Down> {
  static description = 'Delete preview environments'

  static flags = {
    ...envIdFlags,
    ...composeFlags,
    force: Flags.boolean({
      description: 'Do not error if the environment is not found',
      char: 'f',
      default: false,
    }),
  }

  static args = {
  }

  static enableJsonFlag = true

  async run(): Promise<unknown> {
    const log = this.logger
    const { flags } = await this.parse(Down)
    const driver = await this.machineDriver()
    let envId = flags.id
    if (!envId){
      const projectName = flags.project || await findAmbientProjectName(localComposeClient(flags.file))
      log.debug(`project: ${projectName}`)
      envId = flags.id || await findAmbientEnvId(projectName)
      log.debug(`envId: ${envId}`)
    }
    
    const machine = await driver.getMachine({ envId })

    if (!machine && !flags.force) {
      throw new Error(`No machine found for envId ${envId}`)
    }

    if (machine) {
      await driver.removeMachine(machine.providerId)
    }

    if (flags.json) {
      return envId
    }

    this.log(envId)
    return undefined
  }
}
