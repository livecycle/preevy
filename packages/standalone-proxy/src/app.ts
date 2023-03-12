import Fastify, { RawRequestDefaultExpression } from 'fastify'
import { fastifyRequestContext } from '@fastify/request-context'
import { InternalServerError } from './errors'
import { appLoggerFromEnv } from './logging'
import { proxyRoutes } from './proxy'
import { PreviewEnvStore } from './preview-env'

const rewriteUrl = ({ url, headers: { host } }: RawRequestDefaultExpression): string => {
  if (!url) {
    throw new InternalServerError('no url in request')
  }
  if (!host) {
    throw new InternalServerError('no host header in request')
  }

  const target = host.split('.', 1)[0]
  if (!target.includes('-')) {
    return url
  }

  return `/proxy/${target}${url}`
}

export const app = ({ envStore, sshPublicKey }: { 
  envStore: PreviewEnvStore
  sshPublicKey: string
}) =>
  Fastify({
    logger: appLoggerFromEnv(),
    rewriteUrl,
  })
    
    .register(fastifyRequestContext)
    .get('/healthz', { logLevel: 'warn' }, async () => 'OK')
    .get('/ssh-public-key', async () => sshPublicKey)
    .register(proxyRoutes, { prefix: '/proxy/', envStore })

  
    
    
