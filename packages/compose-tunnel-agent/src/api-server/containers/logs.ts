import { inspect } from 'util'
import { createWebSocketStream } from 'ws'
import z from 'zod'
import { FastifyPluginAsync } from 'fastify'
import Dockerode from 'dockerode'
import { DockerFilterClient } from '../../docker'
import { containerIdSchema, logsQueryString } from './schema'
import { inspectFilteredContainer } from './filter'

const handler: FastifyPluginAsync<{
  docker: Dockerode
  dockerFilter: DockerFilterClient
}> = async (app, { docker, dockerFilter }) => {
  app.get<{
    Params: z.infer<typeof containerIdSchema>
    Querystring: z.infer<typeof logsQueryString>
  }>('/:containerId/logs', {
    schema: {
      params: containerIdSchema,
      querystring: logsQueryString,
    },
    websocket: true,
  }, async (
    connection,
    { params: { containerId }, query: { stdout, stderr, since, until, timestamps, tail }, log }
  ) => {
    await inspectFilteredContainer(dockerFilter, containerId)
    const abort = new AbortController()
    const logStream = await docker.getContainer(containerId).logs({
      stdout,
      stderr,
      since,
      until,
      timestamps,
      tail,
      follow: true,
      abortSignal: abort.signal,
    })

    logStream.on('close', async () => { connection.socket.close() })
    logStream.on('error', err => {
      if (err.message !== 'aborted') {
        log.error('logs stream error %j', inspect(err))
      }
    })
    connection.socket.on('close', () => { abort.abort() })

    const wsStream = createWebSocketStream(connection.socket)
    wsStream.on('error', err => { log.error('wsStream error %j', inspect(err)) })
    docker.modem.demuxStream(logStream, wsStream, wsStream)

    return undefined
  })
}

export default handler
