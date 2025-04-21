import { Flags } from '@oclif/core'
import { BaseCommand } from '@preevy/cli-common'
import { login } from '@preevy/core'
import { LC_API_URL, LC_AUTH_URL, LC_CLIENT_ID } from '../defaults.js'


export default class Login extends BaseCommand<typeof Login> {
  static description = 'Login to the Livecycle SaaS'

  static flags = {
    'lc-auth-url': Flags.string({ required: false, default: LC_AUTH_URL, env: 'LC_AUTH_URL', description: 'The login URL' }),
    'lc-api-url': Flags.string({ required: false, default: LC_API_URL, env: 'LC_API_URL', description: "The Livecycle API URL'" }),
    'lc-client-id': Flags.string({ required: false, default: LC_CLIENT_ID, env: 'LC_CLIENT_ID', description: 'The client ID for the OAuth app' }),
  }

  async run(): Promise<void> {
    await login(this.config.dataDir, this.flags['lc-auth-url'], this.flags['lc-api-url'], this.flags['lc-client-id'], this.logger)
  }
}
