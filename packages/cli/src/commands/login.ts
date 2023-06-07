import { Flags } from '@oclif/core'
import { BaseCommand } from '@preevy/cli-common'
import { localFs, login } from '@preevy/core'
import path from 'path'

// eslint-disable-next-line no-use-before-define
export default class Login extends BaseCommand<typeof Login> {
  static description = 'Login to the Livecycle SaaS'

  static flags = {
    'login-url': Flags.string({ required: false, default: 'https://livecycle-local-development.us.auth0.com', description: 'The login URL' }),
  }

  async run(): Promise<void> {
    await login(this.config.dataDir, this.flags['login-url'])
  }
}
