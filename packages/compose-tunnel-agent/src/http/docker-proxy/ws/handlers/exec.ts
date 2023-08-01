import { inspect } from 'util'
import { createWebSocketStream } from 'ws'
import { parseQueryParams, queryParamBoolean } from '../../../query-params'
import { wsHandler } from '../handler'

const handler = wsHandler(
  /^\/exec\/([^/?]+)\/start($|\?)/,
  async (ws, req, match, { log, docker }) => {
    const id = match[1]
    const { tty } = parseQueryParams(req.url ?? '')
    const exec = docker.getExec(id)
    const execStream = await exec.start({
      hijack: true,
      stdin: true,
      ...(tty !== undefined ? { Tty: queryParamBoolean(tty) } : {}),
    })

    execStream.on('close', () => { ws.close() })
    execStream.on('error', err => { log.warn('execStream error %j', inspect(err)) })
    ws.on('close', () => { execStream.destroy() })

    const inspectResults = await exec.inspect()
    log.debug('exec %s: %j', id, inspect(inspectResults))

    const wsStream = createWebSocketStream(ws)
    wsStream.on('error', err => {
      const level = err.message.includes('WebSocket is not open') ? 'debug' : 'warn'
      log[level]('wsStream error %j', inspect(err))
    })

    if (inspectResults.ProcessConfig.tty) {
      execStream.pipe(wsStream, { end: false }).pipe(execStream)
    } else {
      docker.modem.demuxStream(execStream, wsStream, wsStream)
      wsStream.pipe(execStream)
    }

    return undefined
  },
)

export default handler
