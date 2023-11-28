import { Plugin } from '@preevy/cli-common'
import { envCreated, envDeleted } from './hooks'
import { PluginConfig } from './config'
import { upDownFlagsDef } from './flags'
import CommentGithubPr from './commands/github/pr/comment'
import UnCommentGithubPr from './commands/github/pr/uncomment'

export const preevyPlugin: Plugin<PluginConfig> = {
  init: async context => ({
    flags: [
      { command: 'up', flags: upDownFlagsDef },
      { command: 'down', flags: upDownFlagsDef },
    ],
    commands: [CommentGithubPr, UnCommentGithubPr],
    topics: [{
      name: 'github',
      description: 'GitHub integration',
    }],
    hooks: {
      envCreated: envCreated(context),
      envDeleted: envDeleted(context),
    },
  }),
}
