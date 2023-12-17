import fs from 'fs'
import { CiProvider, gitContext } from '@preevy/core'
import { ParsedFlags } from '@preevy/cli-common'
import { tryParseUrlToRepo } from './repo.js'
import { commentTemplateFlagDef, flagsDef, pullRequestFlagsDef } from './flags.js'
import { defaultCommentTemplate } from './lib/github-comment.js'

export type PluginConfig = {
  repo?: string
  token?: string
  commentTemplate?: string
  detect?: boolean
}

export type GithubConfig = {
  repo: { owner: string; repo: string }
  token: string
}

export type GithubPullRequestConfig = GithubConfig & {
  pullRequest: number
}

export type GithubPullRequestCommentConfig = GithubPullRequestConfig & {
  commentTemplate: string
}

export type ConfigFactory<Flags extends {}, T extends GithubConfig, Base extends GithubConfig> = (
  sources: {
    flags: ParsedFlags<Flags>
    pluginConfig: PluginConfig
    env: Record<string, string | undefined>
    ciProvider: () => Promise<CiProvider | undefined> | (CiProvider | undefined)
  },
  base?: Base,
) => Promise<T | undefined>

export const loadGithubConfig: ConfigFactory<typeof flagsDef, GithubConfig, GithubConfig> = async (
  { flags, pluginConfig, env, ciProvider },
  base,
): Promise<GithubConfig | undefined> => {
  if (base) return base

  const token = flags.token ?? env.GITHUB_TOKEN ?? pluginConfig.token
  if (!token) {
    return undefined
  }
  let repo = flags.repo ?? pluginConfig.repo
  if (!repo && pluginConfig.detect !== false) {
    const cip = await ciProvider()
    const url = cip?.repoUrl() ?? await gitContext().remoteTrackingBranchUrl().catch(() => undefined)
    if (url) {
      repo = tryParseUrlToRepo(url)
    }
  }
  if (!repo) {
    return undefined
  }
  return { token, repo }
}

export const loadGithubPullRequestConfig: ConfigFactory<
  typeof flagsDef & typeof pullRequestFlagsDef, GithubPullRequestConfig, GithubConfig
> = async (sources, base) => {
  const ghc = base ?? await loadGithubConfig(sources)
  if (!ghc) {
    return undefined
  }
  const { flags: { 'pull-request': prFlag }, ciProvider, pluginConfig } = sources
  let pr = prFlag
  if (!pr && pluginConfig.detect !== false) {
    const cip = await ciProvider()
    if (cip) {
      pr = cip.pullRequestNumber()
    }
  }
  if (!pr) {
    return undefined
  }
  return { ...ghc, pullRequest: pr }
}

export const loadGithubPullRequestCommentConfig: ConfigFactory<
  typeof flagsDef & typeof pullRequestFlagsDef & typeof commentTemplateFlagDef,
  GithubPullRequestCommentConfig,
  GithubPullRequestConfig
> = async (sources, base) => {
  const ghprc = base ?? await loadGithubPullRequestConfig(sources)
  if (!ghprc) {
    return undefined
  }
  const { flags: { 'pr-comment-template-file': commentTemplateFile }, pluginConfig } = sources
  const commentTemplateFromFile = commentTemplateFile
    ? await fs.promises.readFile(commentTemplateFile, { encoding: 'utf-8' })
    : undefined
  return {
    ...ghprc,
    commentTemplate: commentTemplateFromFile ?? pluginConfig.commentTemplate ?? defaultCommentTemplate,
  }
}
