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

export const configFlags = {
  config: Flags.string({
    description: 'Path to a JSON/YAML configuration file containing the Preevy config',
    multiple: true,
    required: false,
    char: 'c',
    helpGroup: 'GLOBAL',
  }),
}

export const envIdFlags = {
  id: Flags.string({
    description: 'Environment id - affects created URLs. If not specified, will try to detect automatically',
    required: false,
  }),
} as const
