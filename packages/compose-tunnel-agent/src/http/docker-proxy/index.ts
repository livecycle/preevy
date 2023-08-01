import net from 'node:net'
import HttpProxy from 'http-proxy'
import { Logger } from 'pino'
import { inspect } from 'node:util'
import { WebSocketServer } from 'ws'
import Dockerode from 'dockerode'
import { findHandler, handlers as wsHandlers } from './ws'
import { tryHandler, tryUpgradeHandler } from '../http-server-helpers'

export const createDockerProxyHandlers = (
  { log, dockerSocket, docker }: {
    log: Logger
    dockerSocket: string
    docker: Dockerode
  },
) => {
  const proxy = new HttpProxy({
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    target: {
      socketPath: dockerSocket,
    },
  })

  const wss = new WebSocketServer({ noServer: true })

  wss.on('connection', async (ws, req) => {
    const foundHandler = findHandler(wsHandlers, req)
    if (!foundHandler) {
      ws.close(404, 'Not found')
      return undefined
    }

    await foundHandler.handler.handler(ws, req, foundHandler.match, { log, docker })
    return undefined
  })

  const handler = tryHandler({ log }, async (req, res) => {
    proxy.web(req, res)
  })

  const upgradeHandler = tryUpgradeHandler({ log }, async (req, socket, head) => {
    const upgrade = req.headers.upgrade?.toLowerCase()

    if (upgrade === 'websocket') {
      if (findHandler(wsHandlers, req)) {
        wss.handleUpgrade(req, socket, head, client => {
          wss.emit('connection', client, req)
        })
        return undefined
      }

      proxy.ws(req, socket, head, {}, err => {
        log.warn('error in ws proxy %j', inspect(err))
      })
      return undefined
    }

    if (upgrade === 'tcp') {
      const targetSocket = net.createConnection({ path: dockerSocket }, () => {
        const reqBuf = `${req.method} ${req.url} HTTP/${req.httpVersion}\r\n${Object.entries(req.headers).map(([k, v]) => `${k}: ${v}`).join('\r\n')}\r\n\r\n`
        targetSocket.write(reqBuf)
        targetSocket.write(head)
        socket.pipe(targetSocket).pipe(socket)
      })
      return undefined
    }

    log.warn('invalid upgrade %s', upgrade)
    socket.end(`Invalid upgrade ${upgrade}`)
    return undefined
  })

  return { handler, upgradeHandler }
}

export type DockerProxyHandlers = ReturnType<typeof createDockerProxyHandlers>
