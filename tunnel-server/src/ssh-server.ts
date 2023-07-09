import crypto, { randomBytes } from 'crypto'
import { FastifyBaseLogger } from 'fastify/types/logger'
import net from 'net'
import path from 'path'
import ssh2, { ParsedKey, SocketBindInfo } from 'ssh2'
import { inspect } from 'util'
import { ForwardRequest, parseForwardRequest } from './forward-request'

const idFromPublicSsh = (key: Buffer) =>
  crypto.createHash('sha1').update(key).digest('base64url').replace(/[_-]/g, '').slice(0, 8).toLowerCase()

const parseForwardRequestFromSocketBindInfo = (
  { socketPath: request }: Pick<ssh2.SocketBindInfo, 'socketPath'>
): { request: string } & ({ parsed: ForwardRequest } | { error: Error }) => {
  try {
    return { request, parsed: parseForwardRequest(request) }
  } catch (error) {
    return { request, error: error as Error } as const;
  }
}

export type RemoteClient = {
  clientId: string
  publicKey: ParsedKey
}

export type ForwardRequestWithContext = {
  request: string
  parsedRequest: ForwardRequest
  client: RemoteClient
}

export type ForwardSocketEvent = ForwardRequestWithContext & {
  localSocketPath: string
}

export const sshServer = ({
  log,
  sshPrivateKey,
  socketDir,
  onForwardSocketCreated: onPipeCreated,
  onForwardSocketDestroyed: onPipeDestroyed,
  validateForwardRequest,
  onHello,
}: {
  log: FastifyBaseLogger
  sshPrivateKey: string
  socketDir: string
  validateForwardRequest?: (request: ForwardRequestWithContext) => Promise<void>
  onForwardSocketCreated?: (event: ForwardSocketEvent) => void
  onForwardSocketDestroyed?: (event: ForwardSocketEvent) => void
  onHello: (client: RemoteClient, activeTunnelRequests: Record<string, ForwardRequest>) => Promise<string>
}) => new ssh2.Server(
  {
    debug: x => log.debug(x),
    // keepaliveInterval: 1000,
    // keepaliveCountMax: 5,
    hostKeys: [sshPrivateKey],
  },
  (client) => {
    let remoteClient: RemoteClient
    const tunnels = new Map<string, ForwardRequest>()

    client
      .on('error', (err) => log.error(`client error: %j`, inspect(err)))
      .on('authentication', (ctx) => {
        log.debug('authentication: %j', ctx)
        if (ctx.method !== 'publickey') {
          ctx.reject(['publickey'])
          return
        }

        const keyOrError = ssh2.utils.parseKey(ctx.key.data)
        if (!('getPublicSSH' in keyOrError)) {
          log.error('error parsing key: %j', keyOrError)
          ctx.reject()
          return
        }

        // calling "accept" when no signature specified does not result in authenticated state
        // see: https://github.com/mscdex/ssh2/issues/561#issuecomment-303263753
        if (ctx.signature && !keyOrError.verify(ctx.blob as Buffer, ctx.signature, ctx.key.algo)) {
          log.error('error verifying key: %j', keyOrError)
          ctx.reject(['publickey'])
          return
        }

        remoteClient = { publicKey: keyOrError, clientId: idFromPublicSsh(keyOrError.getPublicSSH()) }
        log.debug('accepting clientId %j', remoteClient.clientId)
        ctx.accept()
      })
      .on('request', async (accept, reject, name, info) => {
        log.debug('request %j', { accept, reject, name, info })
        if (!client.authenticated) {
          log.error('not authenticated, rejecting')
          reject?.()
          return
        }

        if ((name as string) == 'cancel-streamlocal-forward@openssh.com') {
          const res = parseForwardRequestFromSocketBindInfo(info as unknown as SocketBindInfo)
          if('error' in res) {
            log.error('cancel-streamlocal-forward@openssh.com: invalid socket path %j: %j', res.request, res.error)
            reject?.()
            return
          }
          if (!tunnels.delete(res.request)) {
            log.error('cancel-streamlocal-forward@openssh.com: request %j not found, rejecting', res.request)
            reject?.()
          }
          accept?.()
          return
        }

        if ((name as string) !== 'streamlocal-forward@openssh.com') {
          log.error('invalid request %j', { name, info })
          reject?.()
          return
        }

        const res = parseForwardRequestFromSocketBindInfo(info as unknown as SocketBindInfo)
        if('error' in res) {
          log.error('streamlocal-forward@openssh.com: rejecting %j, error parsing: %j', res.request, inspect(res.error))
          reject?.()
          return
        }

        const { request, parsed } = res

        if (tunnels.has(request)) {
          log.error('streamlocal-forward@openssh.com: rejecting %j, duplicate socket request', res.request)
          reject?.()
          return
        }

        try {
          await validateForwardRequest?.({ client: remoteClient, request, parsedRequest: parsed })
        } catch (validationError) {
          log.error(
            'streamlocal-forward@openssh.com: rejecting %j, validateForwardRequest returned error: %j',
            res.request,
            inspect(validationError),
          )
          reject?.()
          return
        }

        const socketServer = net.createServer((socket) => {
          log.debug('socketServer connected %j', socket)
          client.openssh_forwardOutStreamLocal(
            request,
            (err, upstream) => {
              if (err) {
                log.error('error forwarding request %j: %s', request, inspect(err))
                socket.end()
                socketServer.close((err) => {
                  log.error('error closing socket server for request %j: %j', request, inspect(err))
                })
                return
              }
              upstream.pipe(socket).pipe(upstream)
            }
          )
        })

        const socketPath = path.join(socketDir, `s_${remoteClient.clientId}_${randomBytes(16).toString('hex')}`)

        const closeSocketServer = () => socketServer.close()

        socketServer
          .listen(socketPath, () => {
            log.debug('streamlocal-forward@openssh.com: calling accept: %j', accept)
            accept?.()
            tunnels.set(request, parsed)
            onPipeCreated?.({
              request,
              parsedRequest: parsed,
              client: remoteClient,
              localSocketPath: socketPath,
            })
          })
          .on('error', (err: unknown) => {
            log.error('socketServer error: %j', err)
            socketServer.close()
          })
          .on('close', () => {
            log.debug('socketServer close: %j', socketPath)
            tunnels.delete(request)
            onPipeDestroyed?.({
              request,
              parsedRequest: parsed,
              client: remoteClient,
              localSocketPath: socketPath,
            })
            client.removeListener('close', closeSocketServer)
          })

        client.once('close', closeSocketServer)
      })
      .on('session', (accept) => {
        log.debug('session')
        const session = accept()

        session.on('exec', async (accept, reject, info) => {
          log.debug('exec %j', info)
          if (info.command !== 'hello') {
            log.error('invalid exec command %j', info.command)
            reject()
            return
          }
          const channel = accept()
          const tunnelsObj = Object.fromEntries([...tunnels.entries()])
          log.info({ clientId: remoteClient.clientId, tunnels: tunnelsObj }, 'client hello')
          channel.stdout.write(await onHello({ ...remoteClient }, tunnelsObj))
          channel.stdout.exit(0)
          if (tunnels.size === 0) {
            channel.close()
          }
        })
      })
  }
)
