import crypto, { randomBytes } from 'crypto'
import { FastifyBaseLogger } from 'fastify/types/logger'
import net from 'net'
import path from 'path'
import ssh2, { ParsedKey, SocketBindInfo } from 'ssh2'
import { inspect } from 'util'
import * as z from 'zod'

const idFromPublicSsh = (key: Buffer) =>
  crypto.createHash('sha1').update(key).digest('base64url').replace(/[_-]/g, '').slice(0, 8).toLowerCase()

const schema = z.object({
  path: z.string(),
  params: z.object({ access: z.enum(['public', 'private']).default('public') }).required(),
})

export const parseRequestedPath = (requestPath: string) => {
  const [path, params] = requestPath.split('#')

  if (!params) {
    return schema.safeParse({ path, params: {} })
  }
  const paramsArray = params.split(';')
  const paramsObject = paramsArray.reduce(
    (acc, param) => {
      const [key, value] = param.split('=')
      return { ...acc, [key]: value }
    },
    {} as Record<string, string>
  )
  return schema.safeParse({ path, params: paramsObject })
}

const getRequestedSocketPath = (info: ssh2.SocketBindInfo) => parseRequestedPath(info.socketPath)

export const sshServer = ({
  log,
  sshPrivateKey,
  socketDir,
  onPipeCreated,
  onPipeDestroyed,
  onHello,
}: {
  log: FastifyBaseLogger
  sshPrivateKey: string
  socketDir: string
  onPipeCreated?: (props: {clientId: string, remotePath: string, localSocketPath: string, publicKey: ParsedKey, access: 'private' | 'public' }) => void
  onPipeDestroyed?: (props: {clientId: string, remotePath: string, localSocketPath: string}) => void
  onHello: (clientId: string, tunnels: string[]) => string
}) => new ssh2.Server(
  {
    debug: x => log.debug(x),
    // keepaliveInterval: 1000,
    // keepaliveCountMax: 5,
    hostKeys: [sshPrivateKey],
  },
  (client) => {
    let clientId: string
    const tunnels = new Set<string>()
    let publicKey: ParsedKey

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

        publicKey = keyOrError
        clientId = idFromPublicSsh(keyOrError.getPublicSSH())
        log.debug('accepting clientId %j', clientId)
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
          const res = getRequestedSocketPath(info as unknown as SocketBindInfo)
          if(!res.success){
            log.error('cancel-streamlocal-forward@openssh.com: invalid socket path %j', res.error)
            reject?.()
            return
          }
          const requestedSocketPath = res.data.path
          if (!tunnels.delete(requestedSocketPath)) {
            log.error('cancel-streamlocal-forward@openssh.com: socketPath %j not found, rejecting', (info as unknown as SocketBindInfo).socketPath)
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

        const res = getRequestedSocketPath(info as unknown as SocketBindInfo)
        if(res.success === false){
          log.error('streamlocal-forward@openssh.com: invalid socket path %j', res.error)
          reject?.()
          return
        }

        const {path: requestedSocketPath, params} = res.data

        if (tunnels.has(requestedSocketPath)) {
          log.error('streamlocal-forward@openssh.com: duplicate socket request %j', requestedSocketPath)
          reject?.()
          return
        }

        const socketServer = net.createServer((socket) => {
          log.debug('socketServer connected %j', socket)
          client.openssh_forwardOutStreamLocal(
            (info as unknown as SocketBindInfo).socketPath,
            (err, upstream) => {
              if (err) {
                log.error('error forwarding: %j', inspect(err))
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
            log.debug('streamlocal-forward@openssh.com: calling accept: %j', accept)
            accept?.()
            tunnels.add(requestedSocketPath)
            onPipeCreated?.({clientId, remotePath: requestedSocketPath, localSocketPath: socketPath, publicKey, access: params.access})
          })
          .on('error', (err: unknown) => {
            log.error('socketServer error: %j', err)
            socketServer.close()
          })
          .on('close', () => {
            log.debug('socketServer close: %j', socketPath)
            tunnels.delete(requestedSocketPath)
            onPipeDestroyed?.({clientId, remotePath: requestedSocketPath, localSocketPath: socketPath})
            client.removeListener('close', closeSocketServer)
          })

        client.once('close', closeSocketServer)
      })
      .on('session', (accept) => {
        log.debug('session')
        const session = accept()

        session.on('exec', (accept, reject, info) => {
          log.debug('exec %j', info)
          if (info.command !== 'hello') {
            log.error('invalid exec command %j', info.command)
            reject()
            return
          }
          const channel = accept()
          log.info({clientId, tunnels: [...tunnels]}, 'client connected')
          channel.stdout.write(onHello(clientId, [...tunnels]))
          channel.stdout.exit(0)
          if (tunnels.size === 0) {
            channel.close()
          }
        })
      })
  }
)
