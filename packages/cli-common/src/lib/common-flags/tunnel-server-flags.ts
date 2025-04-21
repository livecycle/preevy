import { Flags } from '@oclif/core'
import { InferredFlags } from '@oclif/core/lib/interfaces/index.js'

export const tunnelServerFlags = {
  'tunnel-url': Flags.string({
    summary: 'Tunnel url, specify ssh://hostname[:port] or ssh+tls://hostname[:port]',
    char: 't',
    default: process.env.PREVIEW_TUNNEL_OVERRIDE ?? 'ssh+tls://livecycle.run',
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
