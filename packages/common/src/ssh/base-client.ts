import tls, { TLSSocket } from 'tls'
import ssh2, { ParsedKey } from 'ssh2'
import { inspect } from 'util'
import { tryParseJson } from '../json'
import { Logger } from '../log'
import { formatPublicKey, parseKey } from './keys'

export interface BaseUrl {
  protocol: string
  hostname: string
  port: number
}
export type SshBaseConnectionConfig = {
  hostname: string
  port: number
  username: string
  clientPrivateKey: string | Buffer
  insecureSkipVerify: boolean
  knownServerPublicKeys: (string | Buffer)[]
}

export type SshTlsConnectionConfig = SshBaseConnectionConfig & {
  isTls: true
  tlsServerName?: string
}

export type SshPlainConnectionConfig = SshBaseConnectionConfig & {
  isTls: false
}

export type SshConnectionConfig = SshTlsConnectionConfig | SshPlainConnectionConfig

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

export type HelloResponse = {
  clientId: string
  tunnels: Record<string, string>
  baseUrl: BaseUrl
}

const connectTls = (
  { hostname: host, port, tlsServerName, insecureSkipVerify }: Pick<SshTlsConnectionConfig, 'hostname' | 'port' | 'tlsServerName' | 'insecureSkipVerify'>
) => new Promise<TLSSocket>((resolve, reject) => {
  const socket: TLSSocket = tls.connect({
    servername: tlsServerName,
    rejectUnauthorized: !insecureSkipVerify,
    ALPNProtocols: ['ssh'],
    host,
    port,
  }, () => resolve(socket))
  socket.on('error', reject)
})

export const knownKeyHostVerifier = (serverPublicKeys: (string | Buffer)[]) => {
  const serverPublicKeysParsed = serverPublicKeys.map(k => parseKey(k))

  return (key: Buffer | ParsedKey) => {
    const parsedKey = parseKey(key)
    return serverPublicKeysParsed.some(s => s.getPublicPEM() === parsedKey.getPublicPEM())
  }
}

export type SshClientOpts = {
  log: Logger
  connectionConfig: SshConnectionConfig
  onError?: (err: Error) => void
  onHostKey?: (key: Buffer, isVerified: boolean) => void
}

export const baseSshClient = async (
  { log, onError, connectionConfig, onHostKey }: SshClientOpts,
) => {
  const ssh = new ssh2.Client()

  const execHello = () => new Promise<HelloResponse>((resolve, reject) => {
    ssh.exec('hello', (err, stream) => {
      if (err) {
        log.error('error running hello: %j', inspect(err))
        reject(err)
        return
      }
      let buf = Buffer.from([])
      stream.stdout.on('data', (data: Buffer) => {
        log.debug('got data %j', data?.toString())
        buf = Buffer.concat([buf, data])
        const obj = tryParseJson(buf.toString()) as HelloResponse | undefined
        if (obj) {
          log.debug('got hello response %j', obj)
          resolve(obj)
          stream.close()
        }
      })
    })
  })

  const result = { ssh, execHello }

  const {
    isTls, hostname, port, username, clientPrivateKey, insecureSkipVerify, knownServerPublicKeys,
  } = connectionConfig

  const sock = isTls ? await connectTls(connectionConfig) : undefined

  const hostVerifier = (key: Buffer) => {
    const isVerified = insecureSkipVerify
        || (knownKeyHostVerifier(knownServerPublicKeys)(key))
        || isTls

    onHostKey?.(key, isVerified)
    return isVerified
  }

  return new Promise<typeof result>((resolve, reject) => {
    ssh.on('ready', () => resolve(result))
    ssh.on('error', err => {
      reject(err)
      onError?.(err)
    })
    ssh.connect({
      debug: msg => log.debug(msg),
      sock,
      username,
      host: hostname,
      port,
      privateKey: clientPrivateKey,
      keepaliveInterval: 15000,
      keepaliveCountMax: 3,
      hostVerifier,
    })
  })
}
