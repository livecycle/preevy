import Fastify from 'fastify'
import { fastifyRequestContext } from '@fastify/request-context'
import http from 'http'
import internal from 'stream'
import { Logger } from 'pino'
import { SessionStore } from './session'
import { Claims, JwtAuthenticator, authenticator, getIssuerToKeyDataFromEnv, unauthorized } from './auth'
import { PreviewEnvStore } from './preview-env'
import { replaceHostname } from './url'

export const app = ({ isProxyRequest, proxyHandlers, session: sessionManager, baseUrl, envStore, logger }: {
  isProxyRequest: (req: http.IncomingMessage) => boolean
  logger: Logger
  baseUrl: URL
  session: SessionStore<Claims>
  envStore: PreviewEnvStore
  proxyHandlers: {
    upgradeHandler: (req: http.IncomingMessage, socket: internal.Duplex, head: Buffer) => void
    handler: (req: http.IncomingMessage, res: http.ServerResponse) => void
  }
}) =>
  Fastify({
    serverFactory: handler => {
      const { upgradeHandler: proxyUpgradeHandler, handler: proxyHandler } = proxyHandlers
      const server = http.createServer((req, res) => {
        if (req.url !== '/healthz') {
          logger.debug('request %j', { method: req.method, url: req.url, headers: req.headers })
        }
        if (!req.headers.host?.startsWith('auth.') && isProxyRequest(req)) {
          return proxyHandler(req, res)
        }
        return handler(req, res)
      })
        .on('upgrade', (req, socket, head) => {
          logger.debug('upgrade', req.url)
          if (isProxyRequest(req)) {
            return proxyUpgradeHandler(req, socket, head)
          }

          logger.warn('upgrade request %j not found', { url: req.url, host: req.headers.host })
          socket.end('Not found')
          return undefined
        })
      return server
    },
    logger,
  })
    .register(fastifyRequestContext)
    .get<{Querystring: {env: string; returnPath?: string}}>('/login', {
      schema: {
        querystring: {
          properties: {
            env: { type: 'string' },
            returnPath: { type: 'string' },
          },
          required: ['env'],
        },
      },
    }, async (req, res) => {
      const { env: envId, returnPath = '/' } = req.query
      if (!returnPath.startsWith('/')) {
        res.statusCode = 400
        return { error: 'returnPath must be a relative path' }
      }
      const env = await envStore.get(envId)
      if (!env) {
        res.statusCode = 404
        return { error: 'unknown envId' }
      }
      const session = sessionManager(req.raw, res.raw, env.publicKeyThumbprint)
      if (!session.user) {
        const auth = authenticator([JwtAuthenticator(getIssuerToKeyDataFromEnv(env, logger))])
        const result = await auth(req.raw)
        if (!result.isAuthenticated) {
          return unauthorized(res.raw)
        }
        session.set(result.claims)
        session.save()
      }
      return await res.redirect(new URL(returnPath, replaceHostname(baseUrl, `${envId}.${baseUrl.hostname}`)).toString())
    })
    .get('/healthz', { logLevel: 'warn' }, async () => 'OK')
