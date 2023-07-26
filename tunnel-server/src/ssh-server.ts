import crypto, { randomBytes } from 'crypto'
import { FastifyBaseLogger } from 'fastify/types/logger'
import net from 'net'
import path from 'path'
import ssh2, { ParsedKey, SocketBindInfo } from 'ssh2'
import { inspect } from 'util'
import EventEmitter from 'node:events'
import { Writable } from 'node:stream'
import { ForwardRequest, parseForwardRequest } from './forward-request'

const hostnameSuffixFromPublicSsh = (key: Buffer) =>
  crypto.createHash('sha1').update(key).digest('base64url').replace(/[_-]/g, '')
    .slice(0, 8)
    .toLowerCase()

const forwardRequestFromSocketBindInfo = (
  { socketPath: request }: Pick<ssh2.SocketBindInfo, 'socketPath'>
) => request

const parseForwardRequestFromSocketBindInfo = (
  socketBindInfo: Pick<ssh2.SocketBindInfo, 'socketPath'>
): { request: string } & ({ parsed: ForwardRequest } | { error: Error }) => {
  const request = forwardRequestFromSocketBindInfo(socketBindInfo)
  try {
    return { request, parsed: parseForwardRequest(request) }
  } catch (error) {
    return { request, error: error as Error } as const
  }
}

export interface ClientForward extends EventEmitter {
  localSocketPath: string
  on: (event: 'close', listener: () => void) => this
  close: () => void
}

export interface SshClient extends EventEmitter {
  hostnameSuffix: string
  uniqueId: string
  publicKey: ParsedKey
  on: (
    (
      event: 'forward',
      listener: (
        requestId: string,
        request: ForwardRequest,
        accept: () => Promise<ClientForward>,
        reject: (reason: Error) => void,
      ) => void
    ) => this
  ) & (
    (
      event: 'hello',
      listener: (
        channel: { stdout: Writable; exit: (status?: number) => void },
      ) => void
    ) => this
  ) & (
    (
      event: 'error',
      listener: (err: Error) => void,
    ) => this
  ) & (
    (
      event: 'close',
      listener: () => void,
    ) => this
  )
}

export interface SshServer extends EventEmitter {
  close: ssh2.Server['close']
  listen: ssh2.Server['listen']
  on: (
    (
      event: 'client',
      listener: (client: SshClient) => void,
    ) => this
  ) & (
    (
      event: 'error',
      listener: (err: Error) => void,
    ) => this
  )
}

export const sshServer = (
  {
    log,
    sshPrivateKey,
    socketDir,
  }: {
    log: FastifyBaseLogger
    sshPrivateKey: string
    socketDir: string
  }
): SshServer => {
  const serverId = randomBytes(8).toString('base64url').replace(/[^A-Za-z0-9]/g, '')
  let currentClientId = 0
  const serverEmitter = new EventEmitter() as Omit<SshServer, 'close' | 'listen'>
  const server = new ssh2.Server(
    {
      debug: x => log.debug(x),
      // keepaliveInterval: 1000,
      // keepaliveCountMax: 5,
      hostKeys: [sshPrivateKey],
    },
    client => {
      currentClientId += 1
      const uniqueId = `${serverId}-${currentClientId}`
      const clientLog = log.child({ clientUniqueId: uniqueId })
      let preevySshClient: SshClient
      const socketServers = new Map<string, net.Server>()

      client
        .on('authentication', ctx => {
          clientLog.debug('authentication: %j', ctx)
          if (ctx.method !== 'publickey') {
            ctx.reject(['publickey'])
            return
          }

          const keyOrError = ssh2.utils.parseKey(ctx.key.data)
          if (!('getPublicSSH' in keyOrError)) {
            clientLog.error('error parsing key: %j', keyOrError)
            ctx.reject()
            return
          }

          // calling "accept" when no signature specified does not result in authenticated state
          // see: https://github.com/mscdex/ssh2/issues/561#issuecomment-303263753
          if (ctx.signature && !keyOrError.verify(ctx.blob as Buffer, ctx.signature, ctx.key.algo)) {
            clientLog.error('error verifying key: %j', keyOrError)
            ctx.reject(['publickey'])
            return
          }

          preevySshClient = Object.assign(new EventEmitter(), {
            publicKey: keyOrError,
            hostnameSuffix: hostnameSuffixFromPublicSsh(keyOrError.getPublicSSH()),
            uniqueId,
          })
          clientLog.debug('accepting hostnameSuffix %j', preevySshClient.hostnameSuffix)
          ctx.accept()
          serverEmitter.emit('client', preevySshClient)
        })
        .on('request', async (accept, reject, name, info) => {
          clientLog.debug('request %j', { accept, reject, name, info })
          if (!client.authenticated) {
            clientLog.error('not authenticated, rejecting')
            reject?.()
            return
          }

          if ((name as string) === 'cancel-streamlocal-forward@openssh.com') {
            const request = forwardRequestFromSocketBindInfo(info as unknown as SocketBindInfo)
            const deleted = socketServers.get(request)
            if (!deleted) {
              clientLog.error('cancel-streamlocal-forward@openssh.com: request %j not found, rejecting', request)
              reject?.()
              return
            }
            deleted.once('close', () => { accept?.() })
            deleted.close()
            return
          }

          if ((name as string) !== 'streamlocal-forward@openssh.com') {
            clientLog.error('invalid request %j', { name, info })
            reject?.()
            return
          }

          const res = parseForwardRequestFromSocketBindInfo(info as unknown as SocketBindInfo)
          const { request } = res
          if ('error' in res) {
            clientLog.error('streamlocal-forward@openssh.com: rejecting %j, error parsing: %j', request, inspect(res.error))
            reject?.()
            return
          }

          const { parsed } = res

          if (socketServers.has(request)) {
            clientLog.error('streamlocal-forward@openssh.com: rejecting %j, duplicate socket request', request)
            reject?.()
            return
          }

          preevySshClient.emit(
            'forward',
            request,
            parsed,
            () => new Promise<ClientForward>((resolveForward, rejectForward) => {
              const socketServer = net.createServer(socket => {
                clientLog.debug('socketServer connected %j', socket)
                client.openssh_forwardOutStreamLocal(
                  request,
                  (err, upstream) => {
                    if (err) {
                      clientLog.error('error forwarding request %j: %s', request, inspect(err))
                      socket.end()
                      socketServer.close(closeErr => {
                        clientLog.error('error closing socket server for request %j: %j', request, inspect(closeErr))
                      })
                      return
                    }
                    upstream.pipe(socket).pipe(upstream)
                  }
                )
              })

              const socketPath = path.join(socketDir, `s_${preevySshClient.hostnameSuffix}_${randomBytes(16).toString('hex')}`)

              const closeSocketServer = () => socketServer.close()

              socketServer
                .listen(socketPath, () => {
                  clientLog.debug('streamlocal-forward@openssh.com: request %j calling accept: %j', request, accept)
                  accept?.()
                  socketServers.set(request, socketServer)
                  resolveForward(Object.assign(socketServer, { localSocketPath: socketPath }))
                })
                .on('error', (err: unknown) => {
                  clientLog.error('socketServer request %j error: %j', request, err)
                  socketServer.close()
                  rejectForward(err)
                })
                .on('close', () => {
                  clientLog.debug('socketServer close: %j', socketPath)
                  socketServers.delete(request)
                  client.removeListener('close', closeSocketServer)
                })

              client.once('close', closeSocketServer)
            }),
            (reason: Error) => {
              clientLog.error('streamlocal-forward@openssh.com: rejecting %j, reason: %j', request, inspect(reason))
              reject?.()
            }
          )
        })
        .on('error', err => {
          clientLog.error('client error: %j', inspect(err))
          preevySshClient?.emit('error', err)
        })
        .on('close', () => {
          clientLog.debug('client close')
          serverEmitter?.emit('close')
        })
        .on('session', accept => {
          clientLog.debug('session')
          const session = accept()

          session.on('exec', async (acceptExec, rejectExec, info) => {
            clientLog.debug('exec %j', info)
            if (info.command !== 'hello') {
              clientLog.error('invalid exec command %j', info.command)
              rejectExec()
              return
            }

            const channel = acceptExec()
            preevySshClient.emit('hello', {
              stdout: channel.stdout,
              exit: (status: number) => {
                channel.stdout.exit(status)
                if (socketServers.size === 0) {
                  channel.close()
                }
              },
            })
          })
        })
    }
  )

  return Object.assign(serverEmitter, {
    close: server.close.bind(server),
    listen: server.listen.bind(server),
  })
}
