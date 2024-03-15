import net, { AddressInfo, ListenOptions } from 'net'
import * as k8s from '@kubernetes/client-node'
import { promisify } from 'util'
import { Logger } from '@preevy/core'

type ForwardSocket = AsyncDisposable & {
  localSocket: string | AddressInfo
}

const portForward = (
  { namespace, forward, log }: { namespace: string; forward: k8s.PortForward; log: Logger },
) => (
  podName: string,
  targetPort: number,
  listenAddress: number | string | ListenOptions,
) => new Promise<ForwardSocket>((resolve, reject) => {
  const sockets = new Set<net.Socket>()
  const server = net.createServer(socket => {
    socket.on('error', err => { log.debug('forward socket error', err) }) // prevent unhandled rejection
    sockets.add(socket)
    socket.unref()
    socket.on('close', () => { sockets.delete(socket) })
    socket.on('end', () => { sockets.delete(socket) })

    forward.portForward(namespace, podName, [targetPort], socket, null, socket, 10)
      .catch(err => {
        log.debug('forward api error', err)
        socket.emit('error', err)
      })
  })

  server.on('error', reject)

  const closeServer = promisify(server.close.bind(server))

  server.listen(listenAddress, () => {
    resolve({
      localSocket: server.address() as string | AddressInfo,
      [Symbol.asyncDispose]: () => {
        sockets.forEach(s => s.destroy())
        return closeServer()
      },
    })
  })
})

export default portForward
