import { baseSshClient, HelloResponse, SshClientOpts, TunnelNameResolver } from '@preevy/common'
import net from 'net'
import plimit from 'p-limit'
import { inspect } from 'util'
import { RunningService } from '../docker'
import { tunnelSet } from './tunnel-set'

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

  ssh.on('close', () => onError?.(new Error('ssh connection closed')))
  const existingForwards = tunnelSet()

  ssh.on('unix connection', ({ socketPath: forwardRequestId }, accept, reject) => {
    const forward = existingForwards.get(forwardRequestId)
    if (!forward) {
      log.error(`no such unix connection: ${forwardRequestId}`)
      reject()
      return
    }

    const { host, port, sockets } = forward
    log.debug(`forwarding ${forwardRequestId} to ${host}:${port}`)

    const channel = accept()

    const localServiceSocket = net.connect({ host, port }, () => {
      sockets.add(localServiceSocket)
      channel.pipe(localServiceSocket).pipe(channel)
      channel.on('close', () => localServiceSocket.destroy())
      localServiceSocket.on('close', () => {
        sockets.delete(localServiceSocket)
        channel.close()
      })
    })
    localServiceSocket.on('error', err => {
      log.warn(`error forwarding ${forwardRequestId} to ${host}:${port}: %j`, inspect(err))
      channel.close()
    })
  })

  const createForward = (
    service: RunningService,
    forwardRequestId: string,
    host: string,
    port: number,
  ) => new Promise<void>((resolve, reject) => {
    ssh.openssh_forwardInStreamLocal(forwardRequestId, err => {
      if (err) {
        log.error(`error creating forward ${forwardRequestId}: %j`, inspect(err))
        reject(err)
      }
      log.debug('created forward %j', forwardRequestId)
      existingForwards.add({ forwardRequestId, service, host, port, sockets: new Set() })
      resolve()
    })
  })

  const destroyForward = (forwardRequestId: string) => new Promise<void>((resolve, reject) => {
    const forward = existingForwards.get(forwardRequestId)
    if (!forward) {
      const message = `no such forward: ${forwardRequestId}`
      log.error('destroyForward2: %j', forwardRequestId)
      reject(new Error(message))
      return
    }

    const { sockets } = forward
    sockets.forEach(socket => socket.end())

    ssh.openssh_unforwardInStreamLocal(forwardRequestId, () => {
      log.info('destroyed forward %j', forwardRequestId)
      existingForwards.delete(forwardRequestId)
      resolve()
    })
  })

  const tunnelsFromHelloResponse = (helloTunnels: HelloResponse['tunnels']): Tunnel[] => {
    const serviceKey = ({ name, project }: RunningService) => `${name}/${project}`

    const r = Object.entries(helloTunnels).map(([socketPath, url]) => ({ socketPath, url }))
      .reduce(
        (res, { socketPath, url }) => {
          const forward = existingForwards.get(socketPath)
          if (!forward) {
            throw new Error(`no such forward: ${socketPath}`)
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

  const getForwardRequestId = (service: {name: string; project: string; port: number; access: 'private' | 'public'}) => {
    const { tunnel: tunnelName } = tunnelNameResolver({ ...service })
    const metadata = service.access === 'private' ? '#access=private' : ''
    return `/${tunnelName}${metadata}`as const
  }
  let state: SshState
  const limit = plimit(1)

  return {
    updateTunnels: async (services: RunningService[]): Promise<SshState> => limit(async () => {
      const forwards = tunnelSet()
      services.flatMap(service =>
        service.ports.map(x => ({ forwardRequestId: getForwardRequestId({ ...service, port: x }), port: x }))
          .forEach(({ port, forwardRequestId }) => forwards.add(
            { host: service.name, port, service, sockets: new Set(), forwardRequestId }
          )))

      const deletes = existingForwards.difference(forwards)
      await Promise.all([
        [...deletes].map(({ forwardRequestId }) => destroyForward(forwardRequestId)),
      ])
      const inserts = forwards.difference(existingForwards)

      await Promise.all([
        [...inserts].map(({ forwardRequestId, host, port, service }) =>
          createForward(service, forwardRequestId, host, port)),
      ])

      const haveChanges = inserts.size > 0 || deletes.size > 0
      if (haveChanges || !state) {
        state = stateFromHelloResponse(await execHello())
        log.info('tunnel state: %j', state)
      }

      return state
    }),
  }
}
