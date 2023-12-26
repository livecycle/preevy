import z from 'zod'
import { formatPublicKey } from './keys.js'

export const sshBaseConnectionConfigSchema = z.object({
  hostname: z.string(),
  port: z.number(),
  username: z.string(),
  clientPrivateKey: z.string(),
  insecureSkipVerify: z.boolean().default(false),
  knownServerPublicKeys: z.array(z.union([z.string(), z.instanceof(Buffer)])).default([]),
})

export type SshBaseConnectionConfig = z.infer<typeof sshBaseConnectionConfigSchema>

export const sshTlsConnectionConfigSchema = sshBaseConnectionConfigSchema.extend({
  isTls: z.literal(true),
  tlsServerName: z.string().optional(),
})

export type SshTlsConnectionConfig = z.infer<typeof sshTlsConnectionConfigSchema>

export const sshPlainConnectionConfigSchema = sshBaseConnectionConfigSchema.extend({
  isTls: z.literal(false),
})

export type SshPlainConnectionConfig = z.infer<typeof sshPlainConnectionConfigSchema>

export const sshConnectionConfigSchema = z.discriminatedUnion('isTls', [
  sshTlsConnectionConfigSchema,
  sshPlainConnectionConfigSchema,
])

export type SshConnectionConfig = z.infer<typeof sshConnectionConfigSchema>

export const formatSshConnectionConfig = (connectionConfig: SshConnectionConfig) => ({
  ...connectionConfig,
  clientPrivateKey: '*** REDACTED ***',
  clientPublicKey: formatPublicKey(connectionConfig.clientPrivateKey),
})

export const parseSshUrl = (s: string): Pick<SshConnectionConfig, 'hostname' | 'port' | 'isTls'> => {
  const u = new URL(s)
  const isTls = Boolean(u.protocol.match(/(tls)|(https)/))
  return {
    hostname: u.hostname,
    port: Number(u.port || (isTls ? 443 : 22)),
    isTls,
  }
}
