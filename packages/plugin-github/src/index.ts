import { Plugin } from '@preevy/cli-common'
import { envCreated, envDeleted, userModelFilter } from './hooks'
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
      userModelFilter: await userModelFilter(context),
      envCreated: await envCreated(context),
      envDeleted: await envDeleted(context),
    },
  }),
}
