import { Logger } from 'pino'
import Dockerode from 'dockerode'
import fastify from 'fastify'
import cors from '@fastify/cors'
import { validatorCompiler, serializerCompiler, ZodTypeProvider } from 'fastify-type-provider-zod'
import { ComposeTunnelAgentState } from '@preevy/common'
import { SshState } from '../ssh/index.js'
import { DockerFilterClient } from '../docker/index.js'
import { containers } from './containers/index.js'
import { env } from './env.js'

export const createApp = async ({
  log,
  tunnels,
  machineStatus,
  envMetadata,
  composeModelPath,
  dockerFilter,
  docker,
}: {
  log: Logger
  tunnels: () => Promise<SshState & { state: ComposeTunnelAgentState }>
  machineStatus?: () => Promise<{ data: Buffer; contentType: string }>
  envMetadata?: Record<string, unknown>
  composeModelPath: string
  dockerFilter: DockerFilterClient
  docker: Dockerode
}) => {
  const app = await fastify({ logger: log })
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  app.withTypeProvider<ZodTypeProvider>()

  await app.register(cors, {
    allowedHeaders: ['Authorization', 'Content-Type', 'Accept'],
    origin: '*',
    methods: '*',
  })

  app.get('/healthz', { logLevel: 'warn' }, async () => 'OK')

  await app.register(env, { composeModelPath, tunnels, envMetadata, machineStatus })
  await app.register(containers, { docker, dockerFilter, prefix: '/containers' })

  return app
}
