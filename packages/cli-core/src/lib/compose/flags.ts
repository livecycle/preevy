import { Flags } from '@oclif/core'

export const composeFlags = {
  file: Flags.string({
    description: 'Compose configuration file',
    multiple: true,
    required: false,
    char: 'f',
    default: [],
  }),
  project: Flags.string({
    char: 'p',
    description: 'Project name. Defaults to the Compose project name',
    required: false,
  }),
} as const
