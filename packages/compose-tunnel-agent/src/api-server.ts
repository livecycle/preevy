import http from 'node:http'
import { Logger } from '@preevy/common'
import { SshState } from './ssh/index'

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

const createApiServer = ({
  log, currentSshState,
}: {
  log: Logger
  currentSshState: ()=> Promise<SshState>
}) => http.createServer(async (req, res) => {
  log.debug('web request URL: %j', req.url)

  if (!req.url) {
    respondNotFound(res)
    return
  }
  const [path] = req.url.split('?')

  if (path === '/tunnels') {
    respondJson(res, await currentSshState())
    return
  }

  if (path === '/healthz') {
    respond(res, 'OK')
    return
  }

  respondNotFound(res)
})

export default createApiServer
