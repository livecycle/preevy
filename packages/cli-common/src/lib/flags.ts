import { Flags } from '@oclif/core'

export const composeFlags = {
  file: Flags.string({
    description: 'Compose configuration file',
    multiple: true,
    required: false,
    char: 'f',
    default: [],
    helpGroup: 'GLOBAL',
  }),
  'system-compose-file': Flags.string({
    description: 'Add extra Compose configuration file without overriding the defaults',
    multiple: true,
    required: false,
    default: [],
    helpGroup: 'GLOBAL',
  }),
  project: Flags.string({
    char: 'p',
    description: 'Project name. Defaults to the Compose project name',
    required: false,
    helpGroup: 'GLOBAL',
  }),
} as const

export const envIdFlags = {
  id: Flags.string({
    description: 'Environment id - affects created URLs. If not specified, will try to detect automatically',
    required: false,
  }),
} as const
