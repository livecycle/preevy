import fs from 'node:fs'
import url from 'node:url'
import { Logger } from '@preevy/common'
import { SshState } from '../ssh'
import { NotFoundError, respondAccordingToAccept, respondJson, tryHandler } from './http-server-helpers'

const createApiServerHandler = ({ log, currentSshState, machineStatus, envMetadata, composeModelPath }: {
  log: Logger
  currentSshState: () => Promise<SshState>
  machineStatus?: () => Promise<{ data: Buffer; contentType: string }>
  envMetadata?: Record<string, unknown>
  composeModelPath: string
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

  if ((req.method === 'GET' || req.method === 'OPTIONS') && path === '/machine-status' && machineStatus) {
    const { data, contentType } = await machineStatus()
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,PATCH,PUT')
    res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type')
    res.setHeader('Content-Type', contentType)
    res.end(data)
    return
  }

  if (req.method === 'GET' && path === '/metadata' && envMetadata) {
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(envMetadata))
    return
  }

  if (req.method === 'GET' && path === '/compose-model') {
    res.setHeader('Content-Type', 'application/x-yaml')
    res.end(await fs.promises.readFile(composeModelPath, { encoding: 'utf-8' }))
    return
  }

  throw new NotFoundError()
})

export default createApiServerHandler
