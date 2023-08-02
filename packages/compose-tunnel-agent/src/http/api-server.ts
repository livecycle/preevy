import url from 'node:url'
import { Logger } from '@preevy/common'
import { SshState } from '../ssh'
import { NotFoundError, respondAccordingToAccept, respondJson, tryHandler } from './http-server-helpers'

const createApiServerHandler = ({ log, currentSshState, machineStatus }: {
  log: Logger
  currentSshState: () => Promise<SshState>
  machineStatus?: () => Promise<{ data: Buffer; contentType: string }>
}) => tryHandler({ log }, async (req, res) => {
  const { pathname: path } = url.parse(req.url || '')

  if (path === '/healthz') {
    respondAccordingToAccept(req, res, 'OK')
    return
  }

  if (path === '/tunnels') {
    respondJson(res, await currentSshState())
    return
  }

  if (req.method === 'GET' && path === '/machine-status' && machineStatus) {
    const { data, contentType } = await machineStatus()
    res.setHeader('Content-Type', contentType)
    res.end(data)
    return
  }

  throw new NotFoundError()
})

export default createApiServerHandler
