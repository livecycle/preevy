export type TunnelOpts = {
  url: string
  tlsServername?: string
}

export type SshConnectionConfig = {
  hostname: string
  port: number
  isTls: boolean
}

export const parseSshUrl = (s: string): SshConnectionConfig => {
  const u = new URL(s)
  const isTls = Boolean(u.protocol.match(/(tls)|(https)/))
  return {
    hostname: u.hostname,
    port: Number(u.port || (isTls ? 443 : 22)),
    isTls,
  }
}
