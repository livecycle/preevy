import tls, { TLSSocket } from 'tls'
import net from 'net'
import ssh2, { ParsedKey } from 'ssh2'
import { inspect } from 'util'
import { RunningService } from './docker.js'
import { TunnelNameResolver } from './tunnel-name.js'
import * as maps from './maps.js'
import { tryParseJson } from './json.js'

type SshConnectionConfig = {
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

type HelloResponse = {
  clientId: string
  tunnels: Record<string, string>
}

export type Tunnel = {
  project: string
  service: string
  ports: Record<number, string[]>
}

export type SshState = {
  clientId: string
  tunnels: Tunnel[]
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

const parseKey = (...args: Parameters<typeof ssh2.utils.parseKey>): ParsedKey => {
  const parsedKey = ssh2.utils.parseKey(...args)
  if (!('verify' in parsedKey)) {
    throw new Error(`Could not parse key: ${inspect(parsedKey)}`)
  }
  return parsedKey
}

const hostVerifier = (serverPublicKey: string) => {
  const serverPublicKeyParsed = parseKey(serverPublicKey)

  return (key: Buffer) => {
    const parsedKey = parseKey(key)
    const validationResult = serverPublicKeyParsed.getPublicPEM() === parsedKey.getPublicPEM()
    console.log('hostVerifier result', validationResult)
    return validationResult
  }
}

const sshClient = async ({
  serverPublicKey,
  clientPrivateKey,
  sshUrl,
  username,
  tunnelNameResolver,
  onError,
}: {
  serverPublicKey?: string
  clientPrivateKey: string
  sshUrl: string
  username: string
  tunnelNameResolver: TunnelNameResolver
  onError: (err: Error) => void
}) => {
  const connectionConfig = parseSshUrl(sshUrl)

  const ssh = new ssh2.Client()

  type ExistingForward = { service: RunningService; host: string; port: number; sockets: Set<net.Socket> }

  const existingForwards = new Map<string, ExistingForward>()
  const forwardKey = (socketPath: string) => socketPath.replace(/^\//, '')

  ssh.on('unix connection', ({ socketPath }, accept, reject) => {
    const key = forwardKey(socketPath)
    const forward = existingForwards.get(key)
    if (!forward) {
      console.error(`no such unix connection: ${key}`)
      reject()
      return
    }

    const { host, port, sockets } = forward
    console.log(`forwarding ${socketPath} to ${host}:${port}`)

    const localServiceSocket = net.connect({ host, port }, () => {
      sockets.add(localServiceSocket)
      const channel = accept()
      channel.pipe(localServiceSocket).pipe(channel)
      channel.on('close', () => localServiceSocket.destroy())
      localServiceSocket.on('close', () => {
        sockets.delete(localServiceSocket)
        channel.close()
      })
    })
    localServiceSocket.on('error', reject)
  })

  const createForward = (
    service: RunningService,
    tunnel: string,
    host: string,
    port: number,
  ) => new Promise<void>((resolve, reject) => {
    ssh.openssh_forwardInStreamLocal(`/${tunnel}`, err => {
      if (err) {
        console.error(`error creating forward ${tunnel}`, err)
        reject(err)
      }
      console.log('created forward', tunnel)
      existingForwards.set(tunnel, { service, host, port, sockets: new Set() })
      resolve()
    })
  })

  const destroyForward = (tunnel: string) => new Promise<void>((resolve, reject) => {
    const forward = existingForwards.get(tunnel)
    if (!forward) {
      const message = `no such forward: ${tunnel}`
      console.error(message)
      reject(new Error(message))
      return
    }

    const { sockets } = forward
    sockets.forEach(socket => socket.end())

    ssh.openssh_unforwardInStreamLocal(`/${tunnel}`, () => {
      console.log('destroyed forward', tunnel)
      existingForwards.delete(tunnel)
      resolve()
    })
  })

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

  const tunnelsFromHelloResponse = (helloTunnels: HelloResponse['tunnels']): Tunnel[] => {
    const serviceKey = ({ name, project }: RunningService) => `${name}/${project}`

    const r = Object.entries(helloTunnels).map(([socketPath, url]) => ({ socketPath, url }))
      .reduce(
        (res, { socketPath, url }) => {
          const key = forwardKey(socketPath)
          const forward = existingForwards.get(key)
          if (!forward) {
            throw new Error(`no such forward: ${key}`)
          }
          const { service, port } = forward;
          ((res[serviceKey(service)] ||= {
            service: service.name,
            project: service.project,
            ports: {},
          }).ports[port] ||= []).push(url)
          return res
        },
        {} as Record<string, Tunnel>,
      )

    return Object.values(r)
  }

  const stateFromHelloResponse = ({ clientId, tunnels }: HelloResponse): SshState => ({
    clientId, tunnels: tunnelsFromHelloResponse(tunnels),
  })

  let state: SshState

  const result = {
    updateTunnels: async (services: RunningService[]): Promise<SshState> => {
      const forwards = new Map(
        services.flatMap(service => tunnelNameResolver(service)
          .map(({ port, tunnel }) => ([tunnel, { host: service.name, port, service }])))
      )

      const inserts = maps.difference(forwards, existingForwards)
      const deletes = maps.difference(existingForwards, forwards)

      const haveChanges = inserts.size > 0 || deletes.size > 0

      await Promise.all([
        [...inserts.entries()].map(([tunnel, { host, port, service }]) => createForward(service, tunnel, host, port)),
        [...deletes.entries()].map(([tunnel]) => destroyForward(tunnel)),
      ])

      if (haveChanges || !state) {
        state = stateFromHelloResponse(await execHello())
      }

      return state
    },
  }

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
      hostVerifier: serverPublicKey ? hostVerifier(serverPublicKey) : undefined,
    })
  })
}

export default sshClient
