import { baseSshClient, HelloResponse, SshClientOpts, TunnelNameResolver } from '@preevy/common'
import net from 'net'
import plimit from 'p-limit'
import { inspect } from 'util'
import { RunningService } from '../docker'
import { difference } from '../maps'

type Forward = {
  service: RunningService
  host: string
  port: number
  sockets: Set<net.Socket>
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
  const currentForwards = new Map<string, Forward>()

  ssh.on('unix connection', ({ socketPath: forwardRequestId }, accept, reject) => {
    const forward = currentForwards.get(forwardRequestId)
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
    log.debug('createForward: %j', { service, forwardRequestId, host, port })
    ssh.openssh_forwardInStreamLocal(forwardRequestId, err => {
      if (err) {
        log.error('error creating forward %s: %j', forwardRequestId, inspect(err))
        reject(err)
      }
      log.debug('created forward %j', forwardRequestId)
      currentForwards.set(forwardRequestId, { service, host, port, sockets: new Set() })
      resolve()
    })
  })

  const destroyForward = (forwardRequestId: string) => new Promise<void>((resolve, reject) => {
    log.debug('destroyForward: %j', forwardRequestId)
    const forward = currentForwards.get(forwardRequestId)
    if (!forward) {
      const message = `no such forward: ${forwardRequestId}`
      log.error(message)
      reject(new Error(message))
      return
    }

    const { sockets } = forward
    sockets.forEach(socket => socket.end())

    ssh.openssh_unforwardInStreamLocal(forwardRequestId, () => {
      log.info('destroyed forward %j', forwardRequestId)
      currentForwards.delete(forwardRequestId)
      resolve()
    })
  })

  const tunnelsFromHelloResponse = (helloTunnels: HelloResponse['tunnels']): Tunnel[] => {
    const serviceKey = ({ name, project }: RunningService) => `${name}/${project}`

    const r = Object.entries(helloTunnels)
      .reduce(
        (res, [tunnelPrefix, url]) => {
          const forward = [...currentForwards.entries()].find(([x, _]) => x.split('#')[0] === tunnelPrefix)?.[1]
          if (!forward) {
            throw new Error(`no such forward: ${tunnelPrefix}`)
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

  const calcForwardRequestIds = (service: {name: string; project: string; ports: number[]; access: 'private' | 'public'}) => {
    const tunnels = tunnelNameResolver({ ...service })
    const metadata = service.access === 'private' ? '#access=private' : ''
    return tunnels.map(({ port, tunnel }) => ({ port, requestId: `/${tunnel}${metadata}` }))
  }

  let state: SshState
  const limit = plimit(1)

  return {
    updateTunnels: async (services: RunningService[]): Promise<SshState> => await limit(async () => {
      const newKeys = new Map<string, { service: RunningService; port: number }>(
        services.flatMap(
          service => calcForwardRequestIds(service).map(({ port, requestId }) => [requestId, { service, port }])
        )
      )

      const inserts = [...difference(newKeys, currentForwards)]
      const deletes = [...difference(currentForwards, newKeys)]

      log.debug('inserts: %j', inserts)
      log.debug('deletes: %j', deletes)

      await Promise.all([
        ...deletes.map(destroyForward),
        ...inserts.map(key => {
          const { service, port } = newKeys.get(key) as { service: RunningService; port: number }
          return createForward(service, key, service.name, port)
        }),
      ])

      const haveChanges = inserts.length > 0 || deletes.length > 0

      if (haveChanges || !state) {
        state = stateFromHelloResponse(await execHello())
        log.info('tunnel state: %j', state)
      }

      return state
    }),
  }
}
