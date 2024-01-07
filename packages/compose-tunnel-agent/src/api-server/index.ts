import { Logger } from 'pino'
import fastify from 'fastify'
import cors from '@fastify/cors'
import { validatorCompiler, serializerCompiler, ZodTypeProvider } from 'fastify-type-provider-zod'
import { SshState } from '../ssh/index.js'
import { env } from './env.js'

export const baseApp = async ({ log }: { log: Logger }) => {
  const app = await fastify({ logger: log })
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  app.withTypeProvider<ZodTypeProvider>()

  return Object.assign(app, { [Symbol.asyncDispose]: () => app.close() })
}

export const createApp = async ({
  log,
  currentSshState,
  machineStatus,
  envMetadata,
}: {
  log: Logger
  currentSshState: () => Promise<SshState>
  machineStatus?: () => Promise<{ data: Buffer; contentType: string }>
  envMetadata?: Record<string, unknown>
}) => {
  const app = await baseApp({ log })

  await app.register(cors, {
    allowedHeaders: ['Authorization', 'Content-Type', 'Accept'],
    origin: '*',
    methods: '*',
  })

  app.get('/healthz', { logLevel: 'warn' }, async () => 'OK')

  await app.register(env, { currentSshState, envMetadata, machineStatus })

  return app
}
