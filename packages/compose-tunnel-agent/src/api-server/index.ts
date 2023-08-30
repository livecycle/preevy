import fs from 'node:fs'
import url from 'node:url'
import { WebSocketServer } from 'ws'
import { Logger } from 'pino'
import Dockerode from 'dockerode'
import { SshState } from '../ssh'
import { NotFoundError, respond, respondAccordingToAccept, respondJson, tryHandler, tryUpgradeHandler, tryWsHandler } from './http-server-helpers'
import { DockerFilterClient } from '../docker'
import { findHandler as findWsHandler, handlers as wsHandlers } from './ws'
import { ContainerNotFoundError, MissingContainerIdError } from './errors'

// const pathRe = /^\/(?<resourceType>[^/]+)(\/(?<resourceId>[^/]+)(?<action>\/[^/]+)?)?$/

const createApiServerHandlers = ({
  log,
  currentSshState,
  machineStatus,
  envMetadata,
  composeModelPath,
  dockerFilter,
  docker,
}: {
  log: Logger
  currentSshState: () => Promise<SshState>
  machineStatus?: () => Promise<{ data: Buffer; contentType: string }>
  envMetadata?: Record<string, unknown>
  composeModelPath: string
  dockerFilter: DockerFilterClient
  docker: Dockerode
}) => {
  const handler = tryHandler({ log }, async (req, res) => {
    const { pathname: path } = url.parse(req.url || '')

    if (req.method === 'GET' && path === '/healthz') {
      respondAccordingToAccept(req, res, 'OK')
      return
    }

    if (req.method === 'GET' && path === '/tunnels') {
      respondJson(res, await currentSshState())
      return
    }

    if (req.method === 'GET' && path === '/machine-status' && machineStatus) {
      const { data, contentType } = await machineStatus()
      respond(res, data, contentType)
      return
    }

    if (req.method === 'GET' && path === '/metadata' && envMetadata) {
      respondJson(res, envMetadata)
      return
    }

    if (req.method === 'GET' && path === '/compose-model') {
      respond(res, await fs.promises.readFile(composeModelPath, { encoding: 'utf-8' }), 'application/x-yaml')
      return
    }

    if (req.method === 'GET' && path === '/containers') {
      respondJson(res, await dockerFilter.listContainers())
      return
    }

    if (req.method === 'GET' && path?.startsWith('/container/')) {
      const containerId = path.substring('/container/'.length)
      if (!containerId) {
        throw new MissingContainerIdError()
      }
      const container = await dockerFilter.inspectContainer(containerId)
      if (!container) {
        throw new ContainerNotFoundError(containerId)
      }
      respondJson(res, container)
      return
    }

    throw new NotFoundError()
  })

  const wss = new WebSocketServer({ noServer: true })

  wss.on('connection', tryWsHandler({ log }, async (ws, req) => {
    const foundHandler = findWsHandler(wsHandlers, req)
    if (!foundHandler) {
      throw new NotFoundError()
    }
    await foundHandler.handler.handler(ws, req, foundHandler.match, { log, docker, dockerFilter })
  }))

  const upgradeHandler = tryUpgradeHandler({ log }, async (req, socket, head) => {
    if (req.headers.upgrade?.toLowerCase() !== 'websocket') {
      throw new NotFoundError()
    }

    wss.handleUpgrade(req, socket, head, client => {
      wss.emit('connection', client, req)
    })
  })

  return { handler, upgradeHandler }
}

export default createApiServerHandlers
