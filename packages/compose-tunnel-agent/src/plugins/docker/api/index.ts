import Dockerode from 'dockerode'
import { FastifyPluginAsync } from 'fastify'
import z from 'zod'
import fastifyWebsocket from '@fastify/websocket'
import { containerIdSchema } from './schema.js'
import exec from './exec.js'
import logs from './logs.js'
import { ContainerNotFoundError } from './errors.js'
import { DockerFilterClient } from '../filtered-client.js'

const containerIdActionSchema = z.object({
  containerId: z.string(),
  action: z.union([z.literal('stop'), z.literal('start'), z.literal('restart')]),
})

export const containersApi: FastifyPluginAsync<{
  dockerModem: Pick<Dockerode['modem'], 'demuxStream'>
  dockerFilter: DockerFilterClient
}> = async (app, { dockerModem, dockerFilter }) => {
  app.get('/', async () => await dockerFilter.listContainers())

  app.get<{
    Params: z.infer<typeof containerIdSchema>
  }>('/:containerId', {
    schema: {
      params: containerIdSchema,
    },
  }, async ({ params: { containerId } }) => {
    const inspect = await dockerFilter.inspectContainer(containerId)
    if (!inspect) {
      throw new ContainerNotFoundError(containerId)
    }
    return inspect
  })

  app.post<{
    Params: z.infer<typeof containerIdActionSchema>
  }>('/:containerId/:action', {
    schema: {
      params: containerIdActionSchema,
    },
  }, async ({ params: { containerId, action } }) => {
    const container = await dockerFilter.getContainer(containerId)
    if (!container) {
      throw new ContainerNotFoundError(containerId)
    }
    await (container[action] as () => Promise<void>)()
  })

  await app.register(fastifyWebsocket)
  await app.register(exec, { dockerModem, dockerFilter })
  await app.register(logs, { dockerModem, dockerFilter })
}
