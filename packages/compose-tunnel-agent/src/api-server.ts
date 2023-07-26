import http from 'node:http'
import url from 'node:url'
import { Logger } from '@preevy/common'
import { SshState } from './ssh'
import { NotFoundError, respondAccordingToAccept, respondJson, tryHandler } from './http'

const createApiServer = ({ log, currentSshState }: {
  log: Logger
  currentSshState: ()=> Promise<SshState>
}) => {
  const server = http.createServer(tryHandler({ log }, async (req, res) => {
    log.debug('api request: %s %s', req.method || '', req.url || '')

    const { pathname: path } = url.parse(req.url || '')

    if (path === '/tunnels') {
      respondJson(res, await currentSshState())
      return
    }

    if (path === '/healthz') {
      respondAccordingToAccept(req, res, 'OK')
      return
    }

    throw new NotFoundError()
  }))

  return server
}

export default createApiServer
