import crypto from 'crypto'
import { ParsedKey } from 'ssh2'

const concat = (...v: (string | number | undefined)[]) => v.filter(Boolean).join('-')
const tunnel = (port: number, v: (string | number | undefined)[]) => ({ port, tunnel: concat(...v) })

export type TunnelNameResolver = (x: {
  name: string
  project: string
  port: number
}) => {
  port: number
  tunnel: string
}

export const calcServiceSuffix = ({ privateKey, envId }: { privateKey: ParsedKey; envId: string }) => (
  { project, service, port }: { project: string; service: string; port: number },
) => crypto.createHash('sha1')
  .update(privateKey.sign([envId, project, service, port].join('-')))
  .digest()
  .toString('base64url')
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '')

export const tunnelNameResolver = (
  { userDefinedSuffix }: { userDefinedSuffix?: string },
): TunnelNameResolver => (
  { project, name, port }: { project: string; name: string; port: number }
) => tunnel(port, [name, userDefinedSuffix || project])
