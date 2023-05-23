import { Plugin } from '@preevy/cli-common'
import { envCreated } from './hooks/env-created'
import { PluginConfig } from './config'
import { envDeleted } from './hooks/env-deleted'
import { prefixedFlagsDef } from './flags'
import LinkGithubPr from './commands/github-pr/link'
import UnLinkGithubPr from './commands/github-pr/unlink'

export const preevyPlugin: Plugin<PluginConfig> = {
  init: async context => ({
    flags: [
      { command: 'up', flags: prefixedFlagsDef },
      { command: 'down', flags: prefixedFlagsDef },
    ],
    commands: [LinkGithubPr, UnLinkGithubPr],
    topics: [{
      name: 'github-pr',
      description: 'GitHub PR integration',
    }],
    hooks: {
      envCreated: envCreated(context),
      envDeleted: envDeleted(context),
    },
  }),
}
