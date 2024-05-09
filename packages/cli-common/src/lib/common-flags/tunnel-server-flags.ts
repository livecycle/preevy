import { Flags } from '@oclif/core'
import { InferredFlags } from '@oclif/core/lib/interfaces'

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

export const parseTunnelServerFlags = (flags: Omit<InferredFlags<typeof tunnelServerFlags>, 'json'>) => ({
  url: flags['tunnel-url'],
  tlsServerName: flags['tls-hostname'],
  insecureSkipVerify: flags['insecure-skip-verify'],
})
