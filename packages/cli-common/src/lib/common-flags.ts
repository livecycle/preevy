import { Flags } from '@oclif/core'

const projectFlag = {
  project: Flags.string({
    char: 'p',
    description: 'Project name. Defaults to the Compose project name',
    required: false,
    helpGroup: 'GLOBAL',
  }),
}
export const composeFlags = {
  file: Flags.string({
    description: 'Compose configuration file',
    multiple: true,
    singleValue: true,
    required: false,
    char: 'f',
    default: [],
    helpGroup: 'GLOBAL',
  }),
  'system-compose-file': Flags.string({
    description: 'Add extra Compose configuration file without overriding the defaults',
    multiple: true,
    singleValue: true,
    required: false,
    default: [],
    helpGroup: 'GLOBAL',
  }),
  ...projectFlag,
} as const

export const envIdFlags = {
  id: Flags.string({
    description: 'Environment id - affects created URLs. If not specified, will try to detect automatically',
    required: false,
  }),
  ...projectFlag,
} as const

export const tunnelServerFlags = {
  'tunnel-url': Flags.string({
    description: 'Tunnel url, specify ssh://hostname[:port] or ssh+tls://hostname[:port]',
    char: 't',
    default: 'ssh+tls://livecycle.run' ?? process.env.PREVIEW_TUNNEL_OVERRIDE,
  }),
  'tls-hostname': Flags.string({
    description: 'Override TLS server name when tunneling via HTTPS',
    required: false,
  }),
  'insecure-skip-verify': Flags.boolean({
    description: 'Skip TLS or SSH certificate verification',
    default: false,
  }),
} as const

export const urlFlags = {
  'include-access-credentials': Flags.boolean({
    description: 'Include access credentials for basic auth for each service URL',
    default: false,
  }),
  'show-preevy-service-urls': Flags.boolean({
    description: 'Show URLs for internal Preevy services',
    default: false,
  }),
  'access-credentials-type': Flags.custom<'browser' | 'api'>({
    options: ['api', 'browser'],
    dependsOn: ['include-access-credentials'],
    default: 'browser',
    required: true,
  })(),
} as const
