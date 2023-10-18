import { ux, Args } from '@oclif/core'
import { tunnelServerFlags, urlFlags, formatFlagsToArgs } from '@preevy/cli-common'
import { commands } from '@preevy/core'
import { pick } from 'lodash'
import PreevyUrlsCmd from '../urls'
import ProfileCommand from '../../profile-command'

// eslint-disable-next-line no-use-before-define
export default class Urls extends ProfileCommand<typeof Urls> {
  static description = 'Show urls for tunneled local compose application'

  static flags = {
    ...tunnelServerFlags,
    ...urlFlags,
    ...ux.table.flags(),
  }

  static strict = false
  static hidden = true

  static args = {
    'compose-project': Args.string({
      description: 'Compose Project name',
      required: true,
    }),
    ...PreevyUrlsCmd.args,
  }

  static enableJsonFlag = true

  // eslint-disable-next-line class-methods-use-this
  async run(): Promise<unknown> {
    const { args, flags } = this
    const composeInspector = commands.proxy.inspectRunningComposeApp(args['compose-project'])
    const envId = await composeInspector.getEnvId()
    if (!envId) {
      throw new Error('Proxy not running, use preevy proxy connect <compose-project>')
    }
    const commandArgs = [`--id=${envId}`, ...formatFlagsToArgs(flags, PreevyUrlsCmd.flags), ...Object.values(pick(this.args, Object.keys(PreevyUrlsCmd.args))).map(x => `${x}`)]
    await this.config.runCommand('urls', commandArgs)

    return undefined
  }
}
