import tls, { TLSSocket } from 'tls'
import ssh2, { ParsedKey, VerifyCallback } from 'ssh2'
import { inspect } from 'util'
import { tryParseJson } from '../json.js'

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

export type HelloResponse = {
  clientId: string
  tunnels: Record<string, string>
}

const connectTls = (
  { hostname: host, port }: Pick<SshConnectionConfig, 'hostname' | 'port'>
) => new Promise<TLSSocket>((resolve, reject) => {
  const socket: TLSSocket = tls.connect({
    ALPNProtocols: ['ssh'],
    host,
    port,
  }, () => resolve(socket))
  socket.on('error', reject)
})

export const parseKey = (...args: Parameters<typeof ssh2.utils.parseKey>): ParsedKey => {
  const parsedKey = ssh2.utils.parseKey(...args)
  if (!('verify' in parsedKey)) {
    throw new Error(`Could not parse key: ${inspect(parsedKey)}`)
  }
  return parsedKey
}

export const knownKeyHostVerifier = (serverPublicKey: string) => {
  const serverPublicKeyParsed = parseKey(serverPublicKey)

  return async (key: Buffer | ParsedKey) => {
    const parsedKey = parseKey(key)
    const validationResult = serverPublicKeyParsed.getPublicPEM() === parsedKey.getPublicPEM()
    console.log('hostVerifier result', validationResult)
    return validationResult
  }
}

export type SshClientOpts = {
  clientPrivateKey: string
  serverPublicKey?: string
  sshUrl: string
  username: string
  onError: (err: Error) => void
  hostVerifier?: (key: Buffer, connectionConfig: SshConnectionConfig) => Promise<boolean>
}

export const baseSshClient = async ({ clientPrivateKey, sshUrl, username, onError, hostVerifier }: SshClientOpts) => {
  const connectionConfig = parseSshUrl(sshUrl)

  const ssh = new ssh2.Client()

  const execHello = () => new Promise<HelloResponse>((resolve, reject) => {
    ssh.exec('hello', (err, stream) => {
      if (err) {
        console.error(`error running hello: ${err}`)
        reject(err)
        return
      }
      let buf = Buffer.from([])
      stream.stdout.on('data', (data: Buffer) => {
        console.log('got data', data?.toString())
        buf = Buffer.concat([buf, data])
        const obj = tryParseJson(buf.toString()) as HelloResponse | undefined
        if (obj) {
          console.log('got hello response', obj)
          resolve(obj)
          stream.close()
        }
      })
    })
  })

  const result = { ssh, execHello }

  const sock = connectionConfig.isTls ? await connectTls(connectionConfig) : undefined

  return new Promise<typeof result>((resolve, reject) => {
    ssh.on('ready', () => resolve(result))
    ssh.on('error', err => {
      reject(err)
      onError(err)
    })
    ssh.connect({
      sock,
      username,
      host: connectionConfig.hostname,
      port: connectionConfig.port,
      privateKey: clientPrivateKey,
      keepaliveInterval: 20000,
      keepaliveCountMax: 3,
      hostVerifier: hostVerifier && (async (key: Buffer, callback: VerifyCallback) => {
        callback(await hostVerifier(key, connectionConfig))
      }),
    })
  })
}
