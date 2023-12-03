import { Flags, ux } from '@oclif/core'
import { mapValues } from 'lodash'
import { EOL } from 'os'
import { DEFAULT_PLUGINS } from '../plugins/default-plugins'

export * from './build-flags'

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
    singleValue: true,
    required: false,
    char: 'f',
    default: [],
    helpGroup: 'GLOBAL',
  }),
  'system-compose-file': Flags.string({
    summary: 'Add extra Compose configuration file without overriding the defaults',
    multiple: true,
    delimiter: ',',
    singleValue: true,
    required: false,
    default: [],
    helpGroup: 'GLOBAL',
  }),
  ...projectFlag,
} as const

export const pluginFlags = {
  'enable-plugin': Flags.string({
    description: 'Enable plugin with specified package name',
    multiple: true,
    delimiter: ',',
    singleValue: true,
    helpGroup: 'GLOBAL',
    default: DEFAULT_PLUGINS,
  }),
  'disable-plugin': Flags.string({
    description: 'Disable plugin with specified package name',
    multiple: true,
    delimiter: ',',
    singleValue: true,
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

export const tunnelServerFlags = {
  'tunnel-url': Flags.string({
    summary: 'Tunnel url, specify ssh://hostname[:port] or ssh+tls://hostname[:port]',
    char: 't',
    default: 'ssh+tls://livecycle.run' ?? process.env.PREVIEW_TUNNEL_OVERRIDE,
  }),
  'tls-hostname': Flags.string({
    summary: 'Override TLS server name when tunneling via HTTPS',
    required: false,
  }),
  'insecure-skip-verify': Flags.boolean({
    summary: 'Skip TLS or SSH certificate verification',
    default: false,
  }),
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
} as const
