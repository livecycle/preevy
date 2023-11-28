import { Flags } from '@oclif/core'
import { mapKeys } from 'lodash'
import { ParsedFlags, parseFlags } from '@preevy/cli-common'
import { tryParseRepo } from './repo'

const HELP_GROUP = 'GitHub integration'

export const flagsDef = {
  token: Flags.string({
    description: 'GitHub token with write access to the repo',
    required: false,
    helpGroup: HELP_GROUP,
  }),
  repo: Flags.custom<{owner: string; repo: string}>({
    description: 'GitHub repo name in the format owner/repo. Will auto-detect if not specified',
    required: false,
    helpGroup: HELP_GROUP,
    parse: async s => {
      const result = tryParseRepo(s)
      if (!result) {
        throw new Error('Invalid repo format, expected: owner/repo')
      }
      return result
    },
  })(),
} as const

export const pullRequestFlagsDef = {
  'pull-request': Flags.custom<number>({
    description: 'GitHub Pull Request number. Will auto-detect if not specified',
    required: false,
    helpGroup: HELP_GROUP,
    parse: async s => {
      const result = Number(s)
      if (Number.isNaN(s)) {
        throw new Error('Invalid PR number')
      }
      return result
    },
  })(),
} as const

export const commentTemplateFlagDef = {
  'pr-comment-template-file': Flags.string({
    description: 'Path to nunjucks template file',
    required: false,
    helpGroup: HELP_GROUP,
  }),
} as const

const flagPrefix = 'github' as const

type Prefixed<T extends { [k: string]: unknown }> = {
  [K in keyof T as `${typeof flagPrefix}-${string & K}`]: T[K]
}

type ExtractPrefix<S extends string> = S extends `${typeof flagPrefix}-${infer suffix}` ? suffix : never

type Unprefixed<T extends { [k: `${typeof flagPrefix}-${string}`]: unknown }> = {
  [K in keyof T as ExtractPrefix<string & keyof T>]: T[K]
}

const upDownFlagsDefSource = { ...flagsDef, ...pullRequestFlagsDef, ...commentTemplateFlagDef } as const

export const upDownFlagsDef = {
  ...mapKeys(upDownFlagsDefSource, (_v, k) => `${flagPrefix}-${k}`) as Prefixed<typeof upDownFlagsDefSource>,
  [`${flagPrefix}-pr-comment-enabled` as const]: Flags.custom<'auto' | 'no' | 'always'>({
    description: 'Whether to enable posting to the GitHub PR',
    required: false,
    helpGroup: HELP_GROUP,
    options: ['auto', 'no', 'always'],
    default: 'auto',
  })(),
} as const

export const parseUpDownFlagsDef = (argv: string[]) => mapKeys(
  parseFlags(upDownFlagsDef, argv),
  (_v, k) => k.replace(/^github-/, ''),
) as Unprefixed<ParsedFlags<typeof upDownFlagsDef>>
