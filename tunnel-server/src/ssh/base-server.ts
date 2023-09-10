import crypto, { randomBytes } from 'crypto'
import { FastifyBaseLogger } from 'fastify/types/logger'
import net from 'net'
import path from 'path'
import ssh2, { ParsedKey, SocketBindInfo } from 'ssh2'
import { inspect } from 'util'
import EventEmitter from 'node:events'
import { ForwardRequest, parseForwardRequest } from '../forward-request'

const clientIdFromPublicSsh = (key: Buffer) =>
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
}

export interface BaseSshClient extends EventEmitter {
  envId: string
  clientId: string
  publicKey: ParsedKey
  on: (
    (
      event: 'forward',
      listener: (
        requestId: string,
        request: ForwardRequest,
        localSocketPath: string,
        accept: () => Promise<ClientForward>,
        reject: (reason: Error) => void,
      ) => void
    ) => this
  ) & (
    (
      event: 'exec',
      listener: (
        command: string,
        respondWithJson: (content: unknown) => void,
        reject: () => void,
      ) => void
    ) => this
  ) & (
    (
      event: 'error',
      listener: (err: Error) => void,
    ) => this
  )
}

export interface BaseSshServer extends EventEmitter {
  close: ssh2.Server['close']
  listen: ssh2.Server['listen']
  on: (
    (
      event: 'client',
      listener: (client: BaseSshClient) => void,
    ) => this
  ) & (
    (
      event: 'error',
      listener: (err: Error) => void,
    ) => this
  )
}

export const baseSshServer = (
  {
    log,
    sshPrivateKey,
    socketDir,
  }: {
    log: FastifyBaseLogger
    sshPrivateKey: string
    socketDir: string
  }
): BaseSshServer => {
  const serverEmitter = new EventEmitter() as Omit<BaseSshServer, 'close' | 'listen'>
  const server = new ssh2.Server(
    {
      // debug: x => log.debug(x),
      keepaliveInterval: 5000,
      keepaliveCountMax: 3,
      hostKeys: [sshPrivateKey],
    },
    client => {
      let preevySshClient: BaseSshClient
      const socketServers = new Map<string, net.Server>()

      client
        .on('authentication', ctx => {
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

          preevySshClient = Object.assign(new EventEmitter(), {
            publicKey: keyOrError,
            clientId: clientIdFromPublicSsh(keyOrError.getPublicSSH()),
            envId: ctx.username,
          })
          log.debug('accepting clientId %j envId %j', preevySshClient.clientId, preevySshClient.envId)
          ctx.accept()
          serverEmitter.emit('client', preevySshClient)
        })
        .on('request', async (accept, reject, name, info) => {
          log.debug('request %j', { accept, reject, name, info })
          if (!client.authenticated) {
            log.error('not authenticated, rejecting')
            reject?.()
            return
          }

          if ((name as string) === 'cancel-streamlocal-forward@openssh.com') {
            const request = forwardRequestFromSocketBindInfo(info as unknown as SocketBindInfo)
            const deleted = socketServers.get(request)
            if (!deleted) {
              log.error('cancel-streamlocal-forward@openssh.com: request %j not found, rejecting', request)
              reject?.()
              return
            }
            deleted.once('close', () => { accept?.() })
            deleted.close()
            return
          }

          if ((name as string) !== 'streamlocal-forward@openssh.com') {
            log.error('invalid request %j', { name, info })
            reject?.()
            return
          }

          const res = parseForwardRequestFromSocketBindInfo(info as unknown as SocketBindInfo)
          const { request } = res
          if ('error' in res) {
            log.error('streamlocal-forward@openssh.com: rejecting %j, error parsing: %j', request, inspect(res.error))
            reject?.()
            return
          }

          const { parsed } = res

          if (socketServers.has(request)) {
            log.error('streamlocal-forward@openssh.com: rejecting %j, duplicate socket request', request)
            reject?.()
            return
          }

          log.debug('emitting forward: %j', res)

          const socketPath = path.join(socketDir, `s_${preevySshClient.clientId}_${randomBytes(16).toString('hex')}`)

          preevySshClient.emit(
            'forward',
            request,
            parsed,
            socketPath,
            () => new Promise<ClientForward>((resolveForward, rejectForward) => {
              const socketServer = net.createServer(socket => {
                log.debug('socketServer connected')
                client.openssh_forwardOutStreamLocal(
                  request,
                  (err, upstream) => {
                    if (err) {
                      log.error('error forwarding request %j: %s', request, inspect(err))
                      socket.end()
                      socketServer.close(closeErr => {
                        log.error('error closing socket server for request %j: %j', request, inspect(closeErr))
                      })
                      return
                    }
                    upstream.pipe(socket).pipe(upstream)
                  }
                )
              })

              const closeSocketServer = () => socketServer.close()

              socketServer
                .listen(socketPath, () => {
                  log.debug('streamlocal-forward@openssh.com: request %j calling accept: %j', request, accept)
                  accept?.()
                  socketServers.set(request, socketServer)
                  resolveForward(Object.assign(socketServer, { localSocketPath: socketPath }))
                })
                .on('error', (err: unknown) => {
                  log.error('socketServer request %j error: %j', request, err)
                  socketServer.close()
                  rejectForward(err)
                })
                .on('close', () => {
                  log.debug('socketServer close: %j', socketPath)
                  socketServers.delete(request)
                  client.removeListener('close', closeSocketServer)
                })

              client.once('close', closeSocketServer)
              client.once('end', closeSocketServer)
            }),
            (reason: Error) => {
              log.error('streamlocal-forward@openssh.com: rejecting %j, reason: %j', request, inspect(reason))
              reject?.()
            }
          )
        })
        .on('error', err => {
          log.error('client error: %j', inspect(err))
          preevySshClient?.emit('error', err)
          client.end()
        })
        .on('session', accept => {
          log.debug('session')
          const session = accept()

          session.on('exec', async (acceptExec, rejectExec, info) => {
            log.debug('exec %j', info)
            preevySshClient.emit(
              'exec',
              info.command,
              (content: unknown) => {
                const channel = acceptExec()
                channel.stdout.write(JSON.stringify(content))
                channel.stdout.write('\r\n')
                channel.stdout.exit(0)
                if (socketServers.size === 0) {
                  channel.close()
                }
              },
              rejectExec,
            )
          })
        })
    }
  )
    .on('error', (err: unknown) => {
      log.error('ssh server error: %j', err)
    })

  return Object.assign(serverEmitter, {
    close: server.close.bind(server),
    listen: server.listen.bind(server),
  })
}
