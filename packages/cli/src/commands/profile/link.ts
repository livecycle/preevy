import { link, Org, localFs, profileStore, TokenExpiredError, getLivecycleTokensFromLocalFs } from '@preevy/core'
import { Flags, ux } from '@oclif/core'
import inquirer from 'inquirer'
import ProfileCommand from '../../profile-command'
import { LC_API_URL } from '../../defaults'

// eslint-disable-next-line no-use-before-define
export default class Link extends ProfileCommand<typeof Link> {
  static flags = {
    'lc-api-url': Flags.string({ required: false, default: LC_API_URL, env: 'LC_API_URL', description: "The Livecycle API URL'" }),
    access_token: Flags.string({ required: false, env: 'LC_TOKEN', description: "Livecycle's Access Token" }),
    org: Flags.string({ required: false, description: 'Target organization slug for linking the profile' }),
  }

  static description = "Link the profile to the logged in user's organization"

  async run(): Promise<unknown> {
    let accessToken = this.flags.access_token
    if (!accessToken) {
      try {
        accessToken = (await getLivecycleTokensFromLocalFs(localFs(this.config.dataDir)))?.access_token
      } catch (e) {
        if (e instanceof TokenExpiredError) {
          ux.error('Session is expired, please log in again')
        }
        ux.error(`Error loading access token: ${e}`)
      }
    }

    if (accessToken === undefined) {
      ux.error('Please log in to link profile')
    }
    const { store, logger } = this
    const pStore = profileStore(store)
    const tunnelingKey = await pStore.getTunnelingKey()

    await link({ tunnelingKey,
      lcUrl: this.flags['lc-api-url'],
      logger,
      accessToken,
      selectOrg: async (orgs: Org[]) => {
        let { org } = this.flags
        if (!org) {
          if (orgs.length === 1) {
            return orgs[0]
          }
          const selection = await inquirer.prompt<{org: string}>({ type: 'list',
            name: 'org',
            message: 'Choose the organization to link the profile to',
            choices: orgs.map(o => ({
              name: o.name,
              value: o.slug,
            })) })
          org = selection.org
        }
        const orgInfo = orgs.find(o => o.slug === org)
        if (!orgInfo) {
          throw new Error(`Org ${org} doesn't exist or not available for this user`)
        }
        return orgInfo
      } })
    return undefined
  }
}
