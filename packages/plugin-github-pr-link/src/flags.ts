import { Parser } from '@oclif/core/lib/parser/parse'
import { Flags } from '@oclif/core'
import { mapKeys } from 'lodash'
import { tryParseRepo } from './repo'

const HELP_GROUP = 'GitHub PR link'

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
  'comment-template-file': Flags.string({
    description: 'Path to nunjucks template file',
    required: false,
    helpGroup: HELP_GROUP,
  }),
} as const

const flagPrefix = 'github-pr-link' as const

type PrefixedFlagsDef = {
  [K in keyof typeof flagsDef as `${typeof flagPrefix}-${K}`]: typeof flagsDef[K]
}

export const prefixedFlagsDef = {
  ...mapKeys(flagsDef, (_v, k) => `${flagPrefix}-${k}`) as PrefixedFlagsDef,
  [`${flagPrefix}-enabled` as const]: Flags.custom<'auto' | 'no' | 'always'>({
    description: 'Whether to enable posting to the GitHub PR',
    required: false,
    helpGroup: HELP_GROUP,
    options: ['auto', 'no', 'always'],
    default: 'auto',
  })(),
} as const

export const parseFlags = async <T extends {}>(def: T, argv: string[]) => (await new Parser({
  flags: def,
  strict: false,
  args: {},
  context: undefined,
  argv,
}).parse()).flags

export type ParsedFlags<T extends {}> = Awaited<ReturnType<typeof parseFlags<T>>>
