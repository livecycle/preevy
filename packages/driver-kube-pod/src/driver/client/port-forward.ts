import net, { AddressInfo, ListenOptions } from 'net'
import * as k8s from '@kubernetes/client-node'
import { promisify } from 'util'
import { Logger } from '@preevy/core'

type ForwardSocket = {
  localSocket: string | AddressInfo
  close: () => Promise<void>
}

type Closable = { close: () => void }

const portForward = (
  { namespace, forward, log }: { namespace: string; forward: k8s.PortForward; log: Logger },
) => (
  podName: string,
  targetPort: number,
  listenAddress: number | string | ListenOptions,
) => new Promise<ForwardSocket>((resolve, reject) => {
  const sockets = new Set<Closable>()
  const server = net.createServer(async socket => {
    socket.on('error', err => { log.debug('forward socket error', err) }) // prevent unhandled rejection
    const forwardResult = await forward.portForward(namespace, podName, [targetPort], socket, null, socket, 10)
      .catch(err => {
        log.debug('forward api error', err)
        socket.emit('error', err)
      })

    if (!forwardResult) {
      return
    }

    const ws = typeof forwardResult === 'function' ? forwardResult() : forwardResult
    if (!ws) {
      return
    }
    sockets.add(ws)
    ws.on('close', () => { sockets.delete(ws) })
    ws.on('error', err => { log.debug('websocket error', err) }) // prevent unhandled rejection
  })

  server.on('error', reject)

  const closeServer = promisify(server.close.bind(server))

  server.listen(listenAddress, () => {
    resolve({
      localSocket: server.address() as string | AddressInfo,
      close: () => {
        sockets.forEach(ws => ws.close())
        return closeServer()
      },
    })
  })
})

export default portForward
