import { inspect } from 'util'
import { createWebSocketStream } from 'ws'
import { parseQueryParams, queryParamBoolean } from '../../../query-params'
import { wsHandler } from '../handler'

const handler = wsHandler(
  /^\/containers\/([^/?]+)\/logs($|\?)/,
  async (ws, req, match, { log, docker }) => {
    const id = match[1]
    const { stdout, stderr, since, until, timestamps, tail } = parseQueryParams(req.url ?? '')
    const abort = new AbortController()
    const logStream = await docker.getContainer(id).logs({
      stdout: queryParamBoolean(stdout),
      stderr: queryParamBoolean(stderr),
      since,
      until,
      timestamps: queryParamBoolean(timestamps),
      tail: tail !== undefined ? Number(tail) : undefined,
      follow: true,
      abortSignal: abort.signal,
    })

    logStream.on('close', async () => { ws.close() })
    logStream.on('error', err => {
      if (err.message !== 'aborted') {
        log.error('logs stream error %j', inspect(err))
      }
    })
    ws.on('close', () => { abort.abort() })

    const wsStream = createWebSocketStream(ws)
    wsStream.on('error', err => { log.error('wsStream error %j', inspect(err)) })
    docker.modem.demuxStream(logStream, wsStream, wsStream)

    return undefined
  },
)

export default handler
