import events from 'events'
import tls, { TLSSocket } from 'tls'
import ssh2, { ParsedKey } from 'ssh2'
import { promisify } from 'util'
import { tryParseJson } from '../json.js'
import { Logger } from '../log.js'
import { formatPublicKey, parseKey } from './keys.js'

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
  rootUrl: string
}

const connectTls = (
  { hostname: host, port, tlsServerName, insecureSkipVerify }: Pick<SshTlsConnectionConfig, 'hostname' | 'port' | 'tlsServerName' | 'insecureSkipVerify'>
) => new Promise<TLSSocket>((resolve, reject) => {
  const socket: TLSSocket = tls.connect({
    servername: tlsServerName ?? host, // setting the servername to undefined will disable SNI
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
  onHostKey?: (key: Buffer, isVerified: boolean) => void
}

type ReadStream = {
  on: (event: 'data', handler: (data: Buffer) => void) => void
}

export const baseSshClient = async (
  { log, connectionConfig, onHostKey }: SshClientOpts,
) => {
  let ended = false
  const ssh = new ssh2.Client()
  ssh.once('end', () => { ended = true })

  const tryParseJsonChunks = <T>(
    channel: { stdout: ReadStream; close: () => void },
  ) => new Promise<T>(resolve => {
    let buf = Buffer.from([])
    channel.stdout.on('data', (data: Buffer) => {
      log.debug('exec: got data %j', data?.toString())
      buf = Buffer.concat([buf, data])
      const obj = tryParseJson(buf.toString()) as T | undefined
      if (obj) {
        log.debug('exec: got response %j', obj)
        resolve(obj)
        channel.close()
      }
    })
  })

  const execPromise = promisify(ssh.exec.bind(ssh))
  const exec = async <T>(command: string) => {
    const channel = await execPromise(command)
    return await tryParseJsonChunks<T>(channel)
  }

  const result = {
    ssh,
    end: async () => {
      if (!ended) {
        ssh.end()
        await events.once(ssh, 'end')
      }
    },
    execHello: () => exec<HelloResponse>('hello'),
    execTunnelUrl: <T extends string>(tunnels: T[]) => exec<Record<T, string>>(`tunnel-url ${tunnels.join(' ')}`),
  }

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

  return await new Promise<typeof result>((resolve, reject) => {
    ssh.on('ready', () => resolve(result))
    ssh.on('error', err => {
      reject(err)
      ssh.end()
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

export type BaseSshClient = Awaited<ReturnType<typeof baseSshClient>>
