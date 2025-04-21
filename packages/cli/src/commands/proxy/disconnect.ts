import { Args } from '@oclif/core'
import { commands, execPromiseStdout } from '@preevy/core'
import { tableFlags } from '@preevy/cli-common'
import ProfileCommand from '../../profile-command.js'


export default class Disconnect extends ProfileCommand<typeof Disconnect> {
  static description = 'Disconnect tunneled local compose application'

  static flags = {
    ...tableFlags,
  }

  static strict = false
  static hidden = true

  static args = {
    'compose-project': Args.string({
      description: 'Compose Project name',
      required: true,
    }),
  }


  async run(): Promise<unknown> {
    const { args } = this
    const inspector = commands.proxy.inspectRunningComposeApp(args['compose-project'])
    const agentContainer = await inspector.getPreevyAgentContainer()
    if (agentContainer) {
      await execPromiseStdout(`docker rm -f ${agentContainer.id}`)
      this.log(`Removed ${agentContainer.id}, disconnected ${args['compose-project']} tunnel`)
    }
    return undefined
  }
}
