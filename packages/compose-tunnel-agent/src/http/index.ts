import http from 'node:http'
import pino from 'pino'
import { NotFoundError, tryHandler, tryUpgradeHandler } from './http-server-helpers'
import { DockerProxyHandlers } from './docker-proxy'

export const httpServerHandlers = (
  { log, dockerProxyHandlers, apiHandler, dockerProxyPrefix }: {
    log: pino.Logger
    dockerProxyHandlers: DockerProxyHandlers
    dockerProxyPrefix: `/${string}/`
    apiHandler: http.RequestListener
  }
) => {
  const removeDockerPrefix = (s: string) => `/${s.substring(dockerProxyPrefix.length)}`

  const handler = tryHandler({ log }, async (req, res) => {
    log.debug('request %s %s', req.method, req.url)
    if (req.url?.startsWith(dockerProxyPrefix)) {
      req.url = removeDockerPrefix(req.url)
      return await dockerProxyHandlers.handler(req, res)
    }
    return apiHandler(req, res)
  })

  const upgradeHandler = tryUpgradeHandler({ log }, async (req, socket, head) => {
    log.debug('upgrade %s %s', req.method, req.url)
    if (req.url?.startsWith(dockerProxyPrefix)) {
      req.url = removeDockerPrefix(req.url)
      return await dockerProxyHandlers.upgradeHandler(req, socket, head)
    }
    throw new NotFoundError()
  })

  return { handler, upgradeHandler }
}
