import { Plugin } from '@preevy/cli-common'
import { envCreated } from './hooks/env-created'
import { PluginConfig } from './config'
import { envDeleted } from './hooks/env-deleted'
import { flagsDef } from './flags'
import LinkGithubPr from './commands/link-github-pr'

export const preevyPlugin: Plugin<PluginConfig> = {
  init: async context => ({
    flags: [
      { command: 'up', flags: flagsDef },
      { command: 'down', flags: flagsDef },
    ],
    commands: [LinkGithubPr],
    hooks: {
      envCreated: envCreated(context),
      envDeleted: envDeleted(context),
    },
  }),
}
