import { link, Org } from '@preevy/core'
import { Flags } from '@oclif/core'
import inquirer from 'inquirer'
import ProfileCommand from '../../profile-command'
import { LC_API_URL } from '../../defaults'

// eslint-disable-next-line no-use-before-define
export default class Link extends ProfileCommand<typeof Link> {
  static flags = {
    'lc-api-url': Flags.string({ required: false, default: LC_API_URL, env: 'LC_API_URL', description: "The Livecycle API URL'" }),
  }

  static description = "Link the profile to the logged in user's organization"

  async run(): Promise<unknown> {
    await link(this.store, this.config.dataDir, this.flags['lc-api-url'], this.logger, async (orgs: Org[]) => {
      const { org } = await inquirer.prompt<{org: string}>({ type: 'list', name: 'org', message: 'Choose the organization to link the profile to', choices: orgs.map(o => o.name) })
      return orgs.find(o => o.name === org) as Org
    })
    return undefined
  }
}
