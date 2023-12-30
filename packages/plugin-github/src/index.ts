import { Plugin } from '@preevy/cli-common'
import { envCreated, envDeleted, userModelFilter } from './hooks.js'
import { PluginConfig } from './config.js'
import { upDownFlagsDef } from './flags.js'
import CommentGithubPr from './commands/github/pr/comment.js'
import UnCommentGithubPr from './commands/github/pr/uncomment.js'

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
