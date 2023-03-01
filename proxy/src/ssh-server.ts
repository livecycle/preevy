import crypto, { randomBytes } from 'crypto'
import { FastifyBaseLogger } from 'fastify/types/logger'
import net from 'net'
import path from 'path'
import ssh2 from 'ssh2'

const idFromPublicSsh = (key: Buffer) =>
  crypto.createHash('sha1').update(key).digest('base64url').replace(/[_-]/g, '').slice(0, 8).toLowerCase()

export const sshServer = ({
  log,
  sshPrivateKey,
  socketDir,
  onPipeCreated,
  onPipeDestroyed,
  onHello,
}: {
  log: FastifyBaseLogger
  sshPrivateKey: string,
  socketDir: string
  onPipeCreated?: (clientId: string, remotePath: string, localSocketPath: string) => void
  onPipeDestroyed?: (clientId: string, remotePath: string, localSocketPath: string) => void
  onHello: (clientId: string, tunnels: string[]) => string
}) => new ssh2.Server(
  {
    //debug: (x)=> log.debug(x),
    hostKeys: [sshPrivateKey],
  },
  (client) => {
    let clientId: string
    const tunnels = new Set<string>()

    client
      .on('authentication', (ctx) => {
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
        if (ctx.signature && !keyOrError.verify(ctx.blob as Buffer, ctx.signature)) {
          log.error('error verifying key: %j', keyOrError)
          ctx.reject(['publickey'])
          return
        }

        clientId = idFromPublicSsh(keyOrError.getPublicSSH())
        ctx.accept()
      })
      .on('request', (accept, reject, name, info) => {
        log.debug('request %j', { accept, reject, name, info })
        if (!client.authenticated) {
          log.error('not authenticated, rejecting')
          reject?.()
          return
        }

        if ((name as string) == 'cancel-streamlocal-forward@openssh.com') {
          const requestedSocketPath = (info as unknown as { socketPath: string }).socketPath
          if (!tunnels.delete(requestedSocketPath)) {
            log.error('cancel-streamlocal-forward@openssh.com: socketPath %j not found, rejecting', requestedSocketPath)
            reject?.()
            return
          }
        }

        if ((name as string) !== 'streamlocal-forward@openssh.com') {
          log.error('invalid request %j', { name, info })
          reject?.()
          return
        }

        const requestedSocketPath = (info as unknown as { socketPath: string} ).socketPath

        if (tunnels.has(requestedSocketPath)) {
          log.error('duplicate socket request %j', requestedSocketPath)
          reject?.()
          return
        }

        const socketServer = net.createServer((socket) => {
          log.debug('socketServer connected %j', socket)
          client.openssh_forwardOutStreamLocal(
            requestedSocketPath,
            (err, upstream) => {
              if (err) {
                log.error('error forwarding: %j', err)
                socket.end()
                socketServer.close((err) => {
                  log.error('error closing socket server: %j', err)
                })
                return
              }
              upstream.pipe(socket).pipe(upstream)
            }
          )
        })

        const socketPath = path.join(socketDir, `s_${clientId}_${randomBytes(16).toString('hex')}`)

        const closeSocketServer = () => socketServer.close()

        socketServer
          .listen(socketPath, () => {
            log.debug('calling accept: %j', accept)
            accept?.()
            tunnels.add(requestedSocketPath)
            onPipeCreated?.(clientId, requestedSocketPath, socketPath)
          })
          .on('error', (err: unknown) => {
            log.error('socketServer error: %j', err)
            socketServer.close()
          })
          .on('close', () => {
            log.debug('socketServer close: %j', socketPath)
            tunnels.delete(requestedSocketPath)
            onPipeDestroyed?.(clientId, requestedSocketPath, socketPath)
            client.removeListener('close', closeSocketServer)
          })

        client.once('close', closeSocketServer)
      })
      .on('session', (accept) => {
        log.debug('session')
        const session = accept()

        session.on('exec', (accept, reject, info) => {
          if (info.command !== 'hello') {
            reject()
            return
          }
          const channel = accept()
          channel.stdout.write(onHello?.(clientId, [...tunnels]))
          channel.stdout.exit(0)
          channel.close()
        })
      })
  }
)
