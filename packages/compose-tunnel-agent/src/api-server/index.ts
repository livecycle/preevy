import { Logger } from 'pino'
import Dockerode from 'dockerode'
import fastify from 'fastify'
import cors from '@fastify/cors'
import { validatorCompiler, serializerCompiler, ZodTypeProvider } from 'fastify-type-provider-zod'
import { SshState } from '../ssh/index.js'
import { DockerFilterClient } from '../docker/index.js'
import { containers } from './containers/index.js'
import { env } from './env.js'

export const createApp = async ({
  log,
  currentSshState,
  machineStatus,
  envMetadata,
  composeModelPath,
  dockerFilter,
  dockerModem,
}: {
  log: Logger
  currentSshState: () => Promise<SshState>
  machineStatus?: () => Promise<{ data: Buffer; contentType: string }>
  envMetadata?: Record<string, unknown>
  composeModelPath?: string
  dockerFilter: DockerFilterClient
  dockerModem: Pick<Dockerode['modem'], 'demuxStream'>
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
  await app.register(containers, { dockerModem, dockerFilter, prefix: '/containers' })

  return app
}
