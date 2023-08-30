import { inspect } from 'util'
import { createWebSocketStream } from 'ws'
import { parseQueryParams, queryParamBoolean } from '../../query-params'
import { wsHandler } from '../handler'
import { NotFoundError } from '../../http-server-helpers'

const handler = wsHandler(
  /^\/container\/([^/?]+)\/exec($|\?)/,
  async (ws, req, match, { log, docker, dockerFilter }) => {
    const containerId = match[1]
    if (!await dockerFilter.inspectContainer(containerId)) {
      throw new NotFoundError()
    }
    const { obj: { tty: ttyQueryParam }, search } = parseQueryParams(req.url ?? '', { tty: true })
    const cmdQueryParams = search.getAll('cmd')
    const cmd = cmdQueryParams.length ? cmdQueryParams : ['sh']

    const tty = queryParamBoolean(ttyQueryParam)
    const abort = new AbortController()
    const exec = await docker.getContainer(containerId).exec({
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Cmd: cmd,
      Tty: tty,
      abortSignal: abort.signal,
    })

    const execStream = await exec.start({
      hijack: true,
      stdin: true,
      Tty: tty,
    })

    execStream.on('close', () => { ws.close() })
    execStream.on('error', err => { log.warn('execStream error %j', inspect(err)) })
    ws.on('close', () => {
      abort.abort()
      execStream.destroy()
    })

    const inspectResults = await exec.inspect()
    log.debug('exec %s: %j', containerId, inspect(inspectResults))

    const wsStream = createWebSocketStream(ws)
    wsStream.on('error', err => {
      const level = err.message === 'aborted' || err.message.includes('WebSocket is not open') ? 'debug' : 'warn'
      log[level]('wsStream error %j', inspect(err))
    })

    if (tty) {
      execStream.pipe(wsStream, { end: false }).pipe(execStream)
    } else {
      docker.modem.demuxStream(execStream, wsStream, wsStream)
      wsStream.pipe(execStream)
    }

    return undefined
  },
)

export default handler
