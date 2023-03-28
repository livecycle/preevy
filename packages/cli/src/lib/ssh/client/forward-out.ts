import net from 'net'
import path from 'path'
import ssh2 from 'ssh2'
import { randomBytes } from 'crypto'
import rimraf from 'rimraf'
import { Logger } from '../../../log'

export type ForwardOutStreamLocal = {
  localSocket: string
  close: () => void
}

export const forwardOutStreamLocal = (
  ssh: ssh2.Client,
  log: Logger,
  lazySocketDir: () => string,
) => async (
  remoteSocket: string,
) => new Promise<ForwardOutStreamLocal>((resolve, reject) => {
  const socketPath = path.join(lazySocketDir(), `s_${randomBytes(16).toString('hex')}`)

  const socketServer = net.createServer(async socket => {
    socket.on('error', (e: unknown) => log.error(`socket error on socket ${socketPath}`, e))

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

      upstream.on('error', (e: unknown) => log.error(`upstream error on socket ${socketPath}`, e))
      upstream.pipe(socket).pipe(upstream)
    })
  })

  const onConnectionClose = () => {
    log.debug('client close, closing socketServer')
    socketServer.close()
  }

  socketServer
    .listen(socketPath, () => {
      resolve({ localSocket: socketPath, close: () => socketServer.close() })
    })
    .on('error', (err: unknown) => {
      log.error('socketServer error', err)
      socketServer.close()
      reject(err)
    })
    .on('close', async () => {
      log.debug('socketServer closed')
      ssh.removeListener('close', onConnectionClose)
      await rimraf(socketPath)
    })

  ssh.on('close', onConnectionClose)
})
