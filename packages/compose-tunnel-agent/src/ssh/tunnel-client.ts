import { baseSshClient, HelloResponse, ScriptInjection, SshClientOpts, stateEmitter } from '@preevy/common'
import net from 'net'
import plimit from 'p-limit'
import { inspect } from 'util'
import { EventEmitter } from 'tseep'
import { difference } from '../maps.js'
import { Forward } from '../forwards.js'

type InternalForward = Forward & {
  sockets: Set<net.Socket>
}

export type SshState = {
  clientId: string
  forwards: { forward: Forward; url: string }[]
}

const stringifyScriptInjection = (inject: ScriptInjection) => ({
  ...inject,
  ...(inject.pathRegex && { pathRegex: inject.pathRegex.source }),
})

const encodedJson = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')

export const sshClient = async ({
  log,
  connectionConfig,
  defaultAccess,
  globalInjects,
}: Pick<SshClientOpts, 'connectionConfig' | 'log'> & {
  defaultAccess: 'private' | 'public'
  globalInjects: ScriptInjection[]
}) => {
  const baseClient = await baseSshClient({
    log,
    connectionConfig,
  })

  const { ssh, execHello } = baseClient

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

  const stateFromHelloResponse = (
    { clientId, tunnels }: Pick<HelloResponse, 'clientId' | 'tunnels'>,
  ): SshState => ({
    clientId,
    forwards: Object.entries(tunnels).map(([forwardRequestId, url]) => ({
      forward: currentForwards.get(forwardRequestId) as Forward,
      url,
    })),
  })

  const stringifyForwardRequest = (
    { access = defaultAccess, meta, injects, externalName }: Pick<Forward, 'access' | 'meta' | 'injects' | 'externalName'>,
  ) => {
    const allInjects = [...globalInjects, ...(injects ?? [])]
    const args: Record<string, string> = {
      ...(access === 'private' ? { access: 'private' } : {}),
      meta: encodedJson(meta),
      ...allInjects.length ? { inject: encodedJson(allInjects.map(stringifyScriptInjection)) } : {},
    }
    const argsStr = Object.entries(args).map(([k, v]) => `${k}=${v}`).join(';')
    return `/${externalName}#${argsStr}`
  }

  const state = stateEmitter<SshState>(undefined, new EventEmitter<{ state(val: SshState): void }>())
  let hasState = false
  state.addOneTimeListener(() => { hasState = true })
  const limit = plimit(1)

  return {
    state: () => state.current(),
    updateForwards: async (forwards: Forward[]): Promise<void> => await limit(async () => {
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

      if (haveChanges || !hasState) {
        const stateValue = stateFromHelloResponse(await execHello())
        log.info('ssh state: %j', stateValue)
        state.emit(stateValue)
      }
    }),
    ssh,
    [Symbol.asyncDispose]: () => baseClient[Symbol.asyncDispose](),
  }
}
