import { Parser } from '@oclif/core/lib/parser/parse'
import { Flags } from '@oclif/core'
import { tryParseRepo } from './repo'

const FLAG_PREFIX = 'github-pr-link' as const
const HELP_GROUP = 'GitHub PR link'

export const flagsDef = {
  [`${FLAG_PREFIX}-token` as const]: Flags.string({
    description: 'GitHub token with write access to the repo',
    required: false,
    helpGroup: HELP_GROUP,
  }),
  [`${FLAG_PREFIX}-repo` as const]: Flags.custom<{owner: string; repo: string}>({
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
  [`${FLAG_PREFIX}-pr` as const]: Flags.custom<number>({
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
  [`${FLAG_PREFIX}-enabled` as const]: Flags.custom<'auto' | 'no' | 'always'>({
    description: 'Whether to enable posting to the GitHub PR',
    required: false,
    helpGroup: HELP_GROUP,
    options: ['auto', 'no', 'always'],
    default: 'auto',
  })(),
} as const

export const parseFlags = async (argv: string[]) => (await new Parser({
  flags: flagsDef,
  strict: false,
  args: {},
  context: undefined,
  argv,
}).parse()).flags

export type ParsedFlags = Awaited<ReturnType<typeof parseFlags>>
