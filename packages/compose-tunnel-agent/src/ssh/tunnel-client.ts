import { baseSshClient, HelloResponse, ScriptInjection, SshClientOpts, TunnelNameResolver } from '@preevy/common'
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
  ports: Record<number, string>
}

export type SshState = {
  clientId: string
  tunnels: Tunnel[]
}

const stringifiableInject = (inject: ScriptInjection) => ({
  ...inject,
  ...(inject.pathRegex && { pathRegex: inject.pathRegex.source }),
})

const encodedJson = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')

export const sshClient = async ({
  log,
  connectionConfig,
  tunnelNameResolver,
}: Pick<SshClientOpts, 'connectionConfig' | 'log'> & {
  tunnelNameResolver: TunnelNameResolver
}) => {
  const { ssh, execHello, end } = await baseSshClient({
    log,
    connectionConfig,
  })

  ssh.on('error', err => {
    log.error('ssh client error: %j', inspect(err))
    // baseSshClient calls end
  })

  const currentForwards = new Map<string, Forward>()

  ssh.on('unix connection', ({ socketPath: forwardRequestId }, accept, reject) => {
    const forward = currentForwards.get(forwardRequestId)
    if (!forward) {
      log.error(`unix connection: no such forward request "${forwardRequestId}"`)
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
      log.warn(`error forwarding "${forwardRequestId}" to ${host}:${port}: %j`, inspect(err))
      channel.close()
    })
  })

  const createForward = (
    service: RunningService,
    forwardRequest: string,
    host: string,
    port: number,
  ) => new Promise<void>((resolve, reject) => {
    log.debug('createForward: %j', { service, forwardRequestId: forwardRequest, host, port })
    ssh.openssh_forwardInStreamLocal(forwardRequest, err => {
      if (err) {
        log.error('error creating forward %s: %j', forwardRequest, inspect(err))
        reject(err)
      }
      log.debug('created forward %j', forwardRequest)
      currentForwards.set(forwardRequest, { service, host, port, sockets: new Set() })
      resolve()
    })
  })

  const destroyForward = (forwardRequest: string) => new Promise<void>((resolve, reject) => {
    log.debug('destroyForward: %j', forwardRequest)
    const forward = currentForwards.get(forwardRequest)
    if (!forward) {
      const message = `no such forward: ${forwardRequest}`
      log.error(`destroyForward: ${message}`)
      reject(new Error(message))
      return
    }

    const { sockets } = forward
    sockets.forEach(socket => socket.end())

    ssh.openssh_unforwardInStreamLocal(forwardRequest, () => {
      log.info('destroyed forward %j', forwardRequest)
      currentForwards.delete(forwardRequest)
      resolve()
    })
  })

  const tunnelsFromHelloResponse = (helloTunnels: HelloResponse['tunnels']): Tunnel[] => {
    const serviceKey = ({ name, project }: RunningService) => `${name}/${project}`

    const r = Object.entries(helloTunnels)
      .reduce(
        (res, [forwardRequestId, url]) => {
          const forward = currentForwards.get(forwardRequestId)
          if (!forward) {
            throw new Error(`no such forward: ${forwardRequestId}`)
          }
          const { service, port } = forward;
          ((res[serviceKey(service)] ||= {
            service: service.name,
            project: service.project,
            ports: {},
          }).ports[port] = url)
          return res
        },
        {} as Record<string, Tunnel>,
      )

    return Object.values(r)
  }

  const stateFromHelloResponse = ({ clientId, tunnels }: HelloResponse): SshState => ({
    clientId, tunnels: tunnelsFromHelloResponse(tunnels),
  })

  const stringifyForwardRequests = (service: RunningService) => {
    const tunnels = tunnelNameResolver({ ...service })
    return tunnels.map(({ port, tunnel }) => {
      const args: Record<string, string> = {
        ...(service.access === 'private' ? { access: 'private' } : {}),
        meta: encodedJson({
          service: service.name,
          project: service.project,
          port,
        }),
        ...(service.inject?.length
          ? { inject: encodedJson(service.inject.map(stringifiableInject)) }
          : {}
        ),
      }
      const argsStr = Object.entries(args).map(([k, v]) => `${k}=${v}`).join(';')
      return ({ port, requestId: `/${tunnel}#${argsStr}` })
    })
  }

  let state: SshState
  const limit = plimit(1)

  return {
    updateTunnels: async (services: RunningService[]): Promise<SshState> => await limit(async () => {
      const newForwardRequests = new Map<string, { service: RunningService; port: number }>(
        services.flatMap(
          service => stringifyForwardRequests(service).map(({ port, requestId }) => [requestId, { service, port }])
        )
      )

      const inserts = [...difference(newForwardRequests, currentForwards)]
      const deletes = [...difference(currentForwards, newForwardRequests)]

      log.debug('inserts: %j', inserts)
      log.debug('deletes: %j', deletes)

      // delete first: prevent duplicate paths when moving from public to private and vise-versa
      await Promise.all(deletes.map(destroyForward))

      await Promise.all(
        inserts.map(forwardRequest => {
          const { service, port } = newForwardRequests.get(forwardRequest) as { service: RunningService; port: number }
          return createForward(service, forwardRequest, service.name, port)
        }),
      )

      const haveChanges = inserts.length > 0 || deletes.length > 0

      if (haveChanges || !state) {
        state = stateFromHelloResponse(await execHello())
        log.info('tunnel state: %j', state)
      }

      return state
    }),
    end,
    ssh,
  }
}
