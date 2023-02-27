import Fastify, { RawRequestDefaultExpression } from 'fastify'
import { fastifyRequestContext } from '@fastify/request-context'
import { parseHostAndPort } from './hostnames'
import { InternalServerError } from './errors'
import { appLoggerFromEnv } from './logging'
import { apiRoutes } from './api'
import { proxyRoutes } from './proxy'
import { PreviewEnvStore } from './preview-env'

const rewriteUrl = ({ url, headers: { host } }: RawRequestDefaultExpression): string => {
  if (!url) {
    throw new InternalServerError('no url in request')
  }
  if (!host) {
    throw new InternalServerError('no host header in request')
  }

  const target = host.split(".")[0];
  if (target === host) {
    return url
  }

  return `/proxy/${target}/${url}`
}

export const app = ({ envStore }: { envStore: PreviewEnvStore }) =>
  Fastify({
    logger: appLoggerFromEnv(),
    rewriteUrl,
  })
    .register(fastifyRequestContext)
    .get('/healthz', { logLevel: 'warn' }, async () => 'OK')
    .register(apiRoutes, { prefix: '/api/', envStore })
    .register(proxyRoutes, { prefix: '/proxy/', envStore })
