import util from 'util'
import net, { AddressInfo, ListenOptions } from 'net'
import ssh2 from 'ssh2'
import { Logger } from '../../log.js'

export type ForwardOutStreamLocal = AsyncDisposable & {
  localSocket: string | AddressInfo
}

export const forwardOutStreamLocal = ({ ssh, log, listenAddress, remoteSocket, onClose }: {
  ssh: ssh2.Client
  log: Logger
  listenAddress: string | number | ListenOptions
  remoteSocket: string
  onClose?: () => void
}) => new Promise<ForwardOutStreamLocal>((resolve, reject) => {
  const socketServer = net.createServer(async socket => {
    // this error is usually caught and retried by docker-compose, so not need to log it as an error
    socket.on('error', (e: unknown) => log.debug(`socket error on socket ${util.inspect(listenAddress)}`, e))

    ssh.openssh_forwardOutStreamLocal(remoteSocket, (err, upstream) => {
      if (err) {
        log.debug('openssh_forwardOutStreamLocal error', err)
        socket.emit('error', Object.assign(
          new Error(`openssh_forwardOutStreamLocal error: ${err}`, { cause: err }),
          { code: 'ESSHFORWARDOUTERROR' },
        ))
        socket.end()
        return
      }

      upstream.on('error', (e: unknown) => log.error(`upstream error on socket ${util.inspect(listenAddress)}`, e))
      upstream.pipe(socket).pipe(upstream)
    })
  })

  const onConnectionClose = () => {
    log.debug('client close, closing socketServer')
    socketServer.close()
  }

  socketServer
    .listen(listenAddress, () => {
      const address = socketServer.address()
      if (!address) {
        const message = 'socket server listen error'
        log.error(message)
        socketServer.close()
        reject(new Error(message))
        return
      }
      resolve({ localSocket: address, [Symbol.asyncDispose]: async () => { socketServer.close() } })
    })
    .on('error', (err: unknown) => {
      log.error('socketServer error', err)
      socketServer.close()
      reject(err)
    })
    .on('close', async () => {
      log.debug('socketServer closed')
      ssh.removeListener('close', onConnectionClose)
      onClose?.()
    })

  ssh.on('close', onConnectionClose)
})
