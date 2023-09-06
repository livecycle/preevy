import Dockerode from 'dockerode'
import { FastifyPluginAsync } from 'fastify'
import z from 'zod'
import fastifyWebsocket from '@fastify/websocket'
import { DockerFilterClient } from '../../docker'
import { containerIdSchema } from './schema'
import exec from './exec'
import logs from './logs'
import { inspectFilteredContainer } from './filter'

const containerIdActionSchema = z.object({
  containerId: z.string(),
  action: z.union([z.literal('stop'), z.literal('start'), z.literal('restart')]),
})

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
  }, async ({ params: { containerId } }) => await inspectFilteredContainer(dockerFilter, containerId))

  app.post<{
    Params: z.infer<typeof containerIdActionSchema>
  }>('/:containerId/:action', {
    schema: {
      params: containerIdActionSchema,
    },
    preValidation: async ({ params: { containerId } }) => await inspectFilteredContainer(dockerFilter, containerId),
  }, async ({ params: { containerId, action } }) => await docker.getContainer(containerId)[action]())

  await app.register(fastifyWebsocket)
  await app.register(exec, { docker, dockerFilter })
  await app.register(logs, { docker, dockerFilter })
}
