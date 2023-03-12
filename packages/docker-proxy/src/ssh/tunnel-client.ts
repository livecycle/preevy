import net from 'net'
import { inspect } from 'util'
import { RunningService } from '../docker'
import { TunnelNameResolver } from '../tunnel-name'
import * as maps from '../maps'
import { baseSshClient, HelloResponse, SshClientOpts } from './base-client'

export type Tunnel = {
  project: string
  service: string
  ports: Record<number, string[]>
}

export type SshState = {
  clientId: string
  tunnels: Tunnel[]
}

export const sshClient = async ({
  log,
  connectionConfig,
  tunnelNameResolver,
  onError,
}: Pick<SshClientOpts, 'connectionConfig' | 'onError' | 'log'> & {
  tunnelNameResolver: TunnelNameResolver
}) => {
  const { ssh, execHello } = await baseSshClient({
    log,
    connectionConfig,
    onError,
  })

  type ExistingForward = { service: RunningService; host: string; port: number; sockets: Set<net.Socket> }

  const existingForwards = new Map<string, ExistingForward>()
  const forwardKey = (socketPath: string) => socketPath.replace(/^\//, '')

  ssh.on('unix connection', ({ socketPath }, accept, reject) => {
    const key = forwardKey(socketPath)
    const forward = existingForwards.get(key)
    if (!forward) {
      log.error(`no such unix connection: ${key}`)
      reject()
      return
    }

    const { host, port, sockets } = forward
    log.debug(`forwarding ${socketPath} to ${host}:${port}`)

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
        log.error(`error creating forward ${tunnel}: %j`, inspect(err))
        reject(err)
      }
      log.debug('created forward %j', tunnel)
      existingForwards.set(tunnel, { service, host, port, sockets: new Set() })
      resolve()
    })
  })

  const destroyForward = (tunnel: string) => new Promise<void>((resolve, reject) => {
    const forward = existingForwards.get(tunnel)
    if (!forward) {
      const message = `no such forward: ${tunnel}`
      log.error(message)
      reject(new Error(message))
      return
    }

    const { sockets } = forward
    sockets.forEach(socket => socket.end())

    ssh.openssh_unforwardInStreamLocal(`/${tunnel}`, () => {
      log.debug('destroyed forward %j', tunnel)
      existingForwards.delete(tunnel)
      resolve()
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

  return {
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
        log.info('tunnel state: %j', state)
      }

      return state
    },
  }
}
