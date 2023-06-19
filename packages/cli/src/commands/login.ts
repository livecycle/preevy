import { Flags } from '@oclif/core'
import { BaseCommand } from '@preevy/cli-common'
import { login } from '@preevy/core'

// eslint-disable-next-line no-use-before-define
export default class Login extends BaseCommand<typeof Login> {
  static description = 'Login to the Livecycle SaaS'

  static flags = {
    'login-url': Flags.string({ required: false, default: 'https://livecycle-local-development.us.auth0.com', description: 'The login URL' }),
    'lc-url': Flags.string({ required: false, default: 'http://localhost:3000/api', description: "The Livecycle API URL'" }),
  }

  async run(): Promise<void> {
    await login(this.config.dataDir, this.flags['login-url'], this.flags['lc-url'], this.logger)
  }
}
