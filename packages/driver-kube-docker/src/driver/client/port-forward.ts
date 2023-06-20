import net, { AddressInfo, ListenOptions } from 'net'
import * as k8s from '@kubernetes/client-node'
import { promisify } from 'util'

type ForwardSocket = {
  localSocket: string | AddressInfo
  close: () => Promise<void>
}

const portForward = (
  { namespace, forward }: { namespace: string; forward: k8s.PortForward},
) => (
  podName: string,
  targetPort: number,
  listenAddress: number | string | ListenOptions,
) => new Promise<ForwardSocket>((resolve, reject) => {
  const server = net.createServer(async socket => {
    const forwardResult = await forward.portForward(
      namespace,
      podName,
      [targetPort],
      socket,
      null,
      socket
    ).catch(e => {
      reject(e)
      throw e
    })
    const ws = typeof forwardResult === 'function' ? forwardResult() : forwardResult
    if (!ws) {
      reject(new Error('Failed to forward port, no returned WebSocket'))
      return
    }
    server.on('close', () => { ws.close() })
  })

  server.on('error', reject)

  server.listen(listenAddress, () => {
    resolve({
      localSocket: server.address() as string | AddressInfo,
      close: promisify(server.close.bind(server)),
    })
  })
})

export default portForward
