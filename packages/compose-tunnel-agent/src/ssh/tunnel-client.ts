import { baseSshClient, HelloResponse, ScriptInjection, SshClientOpts } from '@preevy/common'
import net from 'net'
import plimit from 'p-limit'
import { inspect } from 'util'
import { difference } from '../maps.js'
import { RunningService } from '../service-discovery.js'
import { ComposeServiceMeta } from '../docker/services.js'

export type Forward<Meta = {}> = {
  host: string
  port: number
  externalName: string
  meta: Meta
  access: 'private' | 'public'
  injects: ScriptInjection[]
}

type InternalForward = Forward & {
  sockets: Set<net.Socket>
}

type SshStateTunnel = {
  project: string
  service: string
  ports: Record<number, string>
}

export type SshState = {
  clientId: string
  tunnels: SshStateTunnel[]
  forwards: { forward: Forward; url: string }[]
}

const stringifiableInject = (inject: ScriptInjection) => ({
  ...inject,
  ...(inject.pathRegex && { pathRegex: inject.pathRegex.source }),
})

const encodedJson = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')

export const sshClient = async ({
  log,
  connectionConfig,
}: Pick<SshClientOpts, 'connectionConfig' | 'log'>) => {
  const { ssh, execHello, end } = await baseSshClient({
    log,
    connectionConfig,
  })

  ssh.on('error', err => {
    log.error('ssh client error: %j', inspect(err))
    // baseSshClient calls end
  })

  const currentForwards = new Map<string, InternalForward>()

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
    forwardRequest: string,
    forward: Forward,
  ) => new Promise<void>((resolve, reject) => {
    log.debug('createForward: %j', { forwardRequest, forward })
    ssh.openssh_forwardInStreamLocal(forwardRequest, err => {
      if (err) {
        log.error('error creating forward %s: %j', forwardRequest, inspect(err))
        reject(err)
      }
      log.debug('created forward %j', forwardRequest)
      currentForwards.set(forwardRequest, { ...forward, sockets: new Set() })
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

  const tunnelsFromHelloResponse = (helloTunnels: HelloResponse['tunnels']): SshStateTunnel[] => {
    const serviceKey = ({ name, project }: Pick<RunningService, 'name' | 'project'>) => `${name}/${project}`

    const r = Object.entries(helloTunnels)
      .reduce(
        (res, [forwardRequestId, url]) => {
          const forward = currentForwards.get(forwardRequestId)
          if (!forward) {
            throw new Error(`no such forward: ${forwardRequestId}`)
          }
          const { meta, port } = forward
          const { service, project } = meta as ComposeServiceMeta
          ((res[serviceKey({ name: service, project })] ||= {
            service,
            project,
            ports: {},
          }).ports[port] = url)
          return res
        },
        {} as Record<string, SshStateTunnel>,
      )

    return Object.values(r)
  }

  const stateFromHelloResponse = (
    { clientId, tunnels }: Pick<HelloResponse, 'clientId' | 'tunnels'>,
  ): SshState => ({
    clientId,
    tunnels: tunnelsFromHelloResponse(tunnels),
    forwards: Object.entries(tunnels).map(([forwardRequestId, url]) => ({
      forward: currentForwards.get(forwardRequestId) as Forward,
      url,
    })),
  })

  const stringifyForwardRequest = (
    { access, meta, injects, externalName }: Pick<Forward, 'access' | 'meta' | 'injects' | 'externalName'>,
  ) => {
    const args: Record<string, string> = {
      ...(access === 'private' ? { access: 'private' } : {}),
      meta: encodedJson(meta),
      ...injects?.length ? { inject: encodedJson(injects.map(stringifiableInject)) } : {},
    }
    const argsStr = Object.entries(args).map(([k, v]) => `${k}=${v}`).join(';')
    return `/${externalName}#${argsStr}`
  }

  let state: SshState
  const limit = plimit(1)

  return {
    updateTunnels: async (forwards: Forward[]): Promise<SshState> => await limit(async () => {
      const newForwardRequests = new Map<string, Forward>(
        forwards.map(f => [stringifyForwardRequest(f), f])
      )

      const inserts = [...difference(newForwardRequests, currentForwards)]
      const deletes = [...difference(currentForwards, newForwardRequests)]

      log.debug('inserts: %j', inserts)
      log.debug('deletes: %j', deletes)

      // delete first: prevent duplicate paths when moving from public to private and vise-versa
      await Promise.all(deletes.map(destroyForward))

      await Promise.all(
        inserts.map(forwardRequest => {
          const forward = newForwardRequests.get(forwardRequest) as Forward
          return createForward(forwardRequest, forward)
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
