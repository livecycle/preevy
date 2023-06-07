import { link } from '@preevy/core'
import { Flags } from '@oclif/core'
import ProfileCommand from '../../profile-command'

// eslint-disable-next-line no-use-before-define
export default class Link extends ProfileCommand<typeof Link> {
  static flags = {
    lcUrl: Flags.string({ required: false, default: 'http://localhost:3000/api', description: "The Livecycle API URL'" }),
  }

  static description = "Link the profile to the logged in user's organization"

  async run(): Promise<unknown> {
    await link(this.store, this.config.dataDir, this.flags.lcUrl)
    return undefined
  }
}
