import { ux, Args } from '@oclif/core'
import { commands, execPromiseStdout } from '@preevy/core'
import ProfileCommand from '../../profile-command'

// eslint-disable-next-line no-use-before-define
export default class Disconnect extends ProfileCommand<typeof Disconnect> {
  static description = 'Disconnect tunneled local compose application'

  static flags = {
    ...ux.table.flags(),
  }

  static strict = false
  static hidden = true

  static args = {
    'compose-project': Args.string({
      description: 'Compose Project name',
      required: true,
    }),
  }

  // eslint-disable-next-line class-methods-use-this
  async run(): Promise<unknown> {
    const { args } = await this.parse(Disconnect)
    const inspector = commands.proxy.inspectRunningComposeApp(args['compose-project'])
    const agentContainerId = await inspector.getPreevyAgentContainer()

    if (agentContainerId) {
      await execPromiseStdout(`docker rm -f ${agentContainerId}`)
      this.log(`Removed ${agentContainerId}, disconnected ${args['compose-project']} tunnel`)
    }
    return undefined
  }
}
