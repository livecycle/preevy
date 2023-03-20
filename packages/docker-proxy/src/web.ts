import http from 'node:http'
import { SshState } from './ssh/index'
import { Logger } from './log'

const respond = (res: http.ServerResponse, content: string, type = 'text/plain', status = 200) => {
  res.writeHead(status, { 'Content-Type': type })
  res.end(content)
}

const respondJson = (
  res: http.ServerResponse,
  content: unknown,
  status = 200,
) => respond(res, JSON.stringify(content), 'application/json', status)

const respondNotFound = (res: http.ServerResponse) => respond(res, 'Not found', 'text/plain', 404)

const createWebServer = ({
  log, currentSshState,
}: {
  log: Logger
  currentSshState: (waitForServices: string[]) => Promise<SshState>
}) => {
  const server = http.createServer(async (req, res) => {
    log.debug('web request URL: %j', req.url)

    if (!req.url) {
      respondNotFound(res)
      return
    }

    const [path, query] = req.url.split('?')
    const params = new URLSearchParams(query)

    if (path === '/tunnels') {
      const waitForServices = params.getAll('waitFor')
        .flatMap(p => p.split(','))
        .map(s => s.trim())
        .filter(Boolean)

      respondJson(res, await currentSshState(waitForServices))
      return
    }

    if (path === '/healthz') {
      respond(res, 'OK')
      return
    }

    respondNotFound(res)
  })

  return server
}

export default createWebServer
