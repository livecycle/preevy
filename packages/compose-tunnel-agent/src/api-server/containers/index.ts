import Dockerode from 'dockerode'
import { FastifyPluginAsync } from 'fastify'
import z from 'zod'
import fastifyWebsocket from '@fastify/websocket'
import { DockerFilterClient } from '../../docker'
import { containerIdSchema } from './schema'
import exec from './exec'
import logs from './logs'
import { inspectFilteredContainer } from './filter'

export const containers: FastifyPluginAsync<{
  docker: Dockerode
  dockerFilter: DockerFilterClient
}> = async (app, { docker, dockerFilter }) => {
  app.get('/', async () => await dockerFilter.listContainers())

  app.get<{
    Params: z.infer<typeof containerIdSchema>
  }>('/:containerId', {
    schema: {
      params: containerIdSchema,
    },
  }, async ({ params: { containerId } }, res) => {
    const container = await inspectFilteredContainer(dockerFilter, containerId)
    void res.send(container)
  })

  await app.register(fastifyWebsocket)
  await app.register(exec, { docker, dockerFilter })
  await app.register(logs, { docker, dockerFilter })
}
