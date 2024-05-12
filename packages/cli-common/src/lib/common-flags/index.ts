import { Flags, ux } from '@oclif/core'
import { mapValues } from 'lodash-es'
import { EOL } from 'os'
import { DEFAULT_PLUGINS } from '../plugins/default-plugins.js'

export * from './build-flags.js'
export * from './tunnel-server-flags.js'

export const tableFlags = mapValues(ux.table.flags(), f => ({ ...f, helpGroup: 'OUTPUT' })) as ReturnType<typeof ux.table['flags']>

const projectFlag = {
  project: Flags.string({
    char: 'p',
    summary: 'Project name. Defaults to the Compose project name',
    required: false,
    helpGroup: 'GLOBAL',
  }),
}
export const composeFlags = {
  file: Flags.string({
    summary: 'Compose configuration file',
    multiple: true,
    delimiter: ',',
    multipleNonGreedy: true,
    required: false,
    char: 'f',
    default: [],
    helpGroup: 'GLOBAL',
  }),
  'system-compose-file': Flags.string({
    summary: 'Add extra Compose configuration file without overriding the defaults',
    multiple: true,
    delimiter: ',',
    multipleNonGreedy: true,
    required: false,
    default: [],
    helpGroup: 'GLOBAL',
  }),
  'project-directory': Flags.string({
    required: false,
    summary: 'Alternate working directory (default: the path of the first specified Compose file)',
  }),
  ...projectFlag,
} as const

export const pluginFlags = {
  'enable-plugin': Flags.string({
    description: 'Enable plugin with specified package name',
    multiple: true,
    delimiter: ',',
    multipleNonGreedy: true,
    helpGroup: 'GLOBAL',
    default: DEFAULT_PLUGINS,
  }),
  'disable-plugin': Flags.string({
    description: 'Disable plugin with specified package name',
    multiple: true,
    delimiter: ',',
    multipleNonGreedy: true,
    helpGroup: 'GLOBAL',
  }),
} as const

export const envIdFlags = {
  id: Flags.string({
    summary: 'Environment id',
    description: `Affects created URLs${EOL}If not specified, will detect from the current Git context`,
    required: false,
  }),
  ...projectFlag,
} as const

export const urlFlags = {
  'include-access-credentials': Flags.boolean({
    summary: 'Include access credentials for basic auth for each service URL',
    default: false,
  }),
  'show-preevy-service-urls': Flags.boolean({
    summary: 'Show URLs for internal Preevy services',
    default: false,
  }),
  'access-credentials-type': Flags.custom<'browser' | 'api'>({
    summary: 'Access credentials type',
    options: ['api', 'browser'],
    dependsOn: ['include-access-credentials'],
    default: 'browser',
    required: true,
  })(),
  'output-urls-to': Flags.file({
    description: 'Output URLs to file',
    required: false,
  }),
  'fetch-urls-timeout': Flags.integer({
    summary: 'Timeout for fetching URLs request in milliseconds',
    default: 2500,
  }),
} as const
