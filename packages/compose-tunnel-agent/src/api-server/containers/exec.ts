import { inspect } from 'util'
import { createWebSocketStream } from 'ws'
import z from 'zod'
import { FastifyPluginAsync } from 'fastify'
import Dockerode from 'dockerode'
import { DockerFilterClient } from '../../docker/index.js'
import { containerIdSchema, execQueryString } from './schema.js'
import { inspectFilteredContainer } from './filter.js'

const handler: FastifyPluginAsync<{
  docker: Dockerode
  dockerFilter: DockerFilterClient
}> = async (app, { docker, dockerFilter }) => {
  app.get<{
    Params: z.infer<typeof containerIdSchema>
    Querystring: z.infer<typeof execQueryString>
  }>('/:containerId/exec', {
    schema: {
      params: containerIdSchema,
      querystring: execQueryString,
    },
    websocket: true,
  }, async (connection, { params: { containerId }, query: { tty, cmd }, log }) => {
    await inspectFilteredContainer(dockerFilter, containerId)
    const abort = new AbortController()
    const exec = await docker.getContainer(containerId).exec({
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Cmd: cmd,
      Tty: tty,
      abortSignal: abort.signal,
    })

    const execStream = await exec.start({
      hijack: true,
      stdin: true,
      Tty: tty,
    })

    execStream.on('close', () => { connection.socket.close() })
    execStream.on('error', err => { log.warn('execStream error %j', inspect(err)) })
    connection.socket.on('close', () => {
      abort.abort()
      execStream.destroy()
    })

    const inspectResults = await exec.inspect()
    log.debug('exec %s: %j', containerId, inspect(inspectResults))

    const wsStream = createWebSocketStream(connection.socket)
    wsStream.on('error', err => {
      const level = err.message === 'aborted' || err.message.includes('WebSocket is not open') ? 'debug' : 'warn'
      log[level]('wsStream error %j', inspect(err))
    })

    if (tty) {
      execStream.pipe(wsStream, { end: false }).pipe(execStream)
    } else {
      docker.modem.demuxStream(execStream, wsStream, wsStream)
      wsStream.pipe(execStream)
    }

    return undefined
  })
}

export default handler
