import url from 'node:url'
import { Logger } from '@preevy/common'
import { SshState } from '../ssh'
import { NotFoundError, respondAccordingToAccept, respondJson, tryHandler } from './http-server-helpers'

const createApiServerHandler = ({ log, currentSshState }: {
  log: Logger
  currentSshState: ()=> Promise<SshState>
}) => tryHandler({ log }, async (req, res) => {
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
})

export default createApiServerHandler
