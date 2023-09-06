import { Logger } from 'pino'
import Dockerode from 'dockerode'
import fastify from 'fastify'
import cors from '@fastify/cors'
import { validatorCompiler, serializerCompiler, ZodTypeProvider } from 'fastify-type-provider-zod'
import { SshState } from '../ssh'
import { DockerFilterClient } from '../docker'
import { containers } from './containers'
import { env } from './env'

export const createApp = async ({
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

  await app.register(env, { composeModelPath, currentSshState, envMetadata, machineStatus })
  await app.register(containers, { docker, dockerFilter, prefix: '/containers' })

  return app
}
