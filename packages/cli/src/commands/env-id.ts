import { ux } from '@oclif/core'
import { findEnvId } from '@preevy/core'
import ProfileCommand from '../profile-command.js'
import { envIdFlags } from '../common-flags.js'

// eslint-disable-next-line no-use-before-define
export default class EnvId extends ProfileCommand<typeof EnvId> {
  static description = 'Show the Preevy environment ID for the current Compose project'

  static flags = {
    ...envIdFlags,
  }

  static enableJsonFlag = true

  static args = {}

  async run(): Promise<unknown> {
    const log = this.logger
    const { flags, args } = this

    const envId = await findEnvId({
      userSpecifiedEnvId: flags.id,
      userSpecifiedProjectName: flags.project,
      userModel: () => this.ensureUserModel(),
      log,
      explanationLogLevel: 'debug',
    })

    if (this.jsonEnabled()) {
      return envId
    }

    ux.log(envId)
    return undefined
  }
}
