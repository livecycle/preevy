import Fastify from 'fastify'
import { fastifyRequestContext } from '@fastify/request-context'
import http from 'http'
import internal from 'stream'
import { Logger } from 'pino'
import { KeyObject } from 'crypto'
import { SessionStore } from './session'
import { Claims, createGetVerificationData, jwtAuthenticator } from './auth'
import { ActiveTunnelStore } from './preview-env'
import { replaceHostname } from './url'

const { SAAS_BASE_URL } = process.env
if (SAAS_BASE_URL === undefined) { throw new Error('Env var SAAS_BASE_URL is missing') }

export const app = (
  { proxyHandlers, sessionStore, baseUrl, envStore, log, loginUrl, publicKey, jwtSaasIssuer }: {
  log: Logger
  baseUrl: URL
  loginUrl: string
  sessionStore: SessionStore<Claims>
  envStore: ActiveTunnelStore
  proxyHandlers: {
    upgradeHandler: (req: http.IncomingMessage, socket: internal.Duplex, head: Buffer) => void
    handler: (req: http.IncomingMessage, res: http.ServerResponse) => void
  }
  publicKey: KeyObject
  jwtSaasIssuer: string
}
) =>
  Fastify({
    serverFactory: handler => {
      const { upgradeHandler: proxyUpgradeHandler, handler: proxyHandler } = proxyHandlers

      const baseHostname = baseUrl.hostname
      const authHostname = `auth.${baseHostname}`
      const isProxyRequest = ({ headers }: http.IncomingMessage) => {
        const host = headers.host?.split(':')?.[0]
        return host && (host !== authHostname && (host === baseHostname || host.endsWith(`.${baseHostname}`)))
      }

      const server = http.createServer((req, res) => {
        if (req.url !== '/healthz') {
          log.debug('request %j', { method: req.method, url: req.url, headers: req.headers })
        }
        return isProxyRequest(req) ? proxyHandler(req, res) : handler(req, res)
      })
        .on('upgrade', (req, socket, head) => {
          log.debug('upgrade', req.url)
          if (isProxyRequest(req)) {
            return proxyUpgradeHandler(req, socket, head)
          }

          log.warn('upgrade request %j not found', { url: req.url, host: req.headers.host })
          socket.end('Not found')
          return undefined
        })
      return server
    },
    logger: log,
  })
    .register(fastifyRequestContext)
    .get<{Querystring: {env: string; returnPath?: string}}>('/login', {
      schema: {
        querystring: {
          type: 'object',
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
      const session = sessionStore(req.raw, res.raw, env.publicKeyThumbprint)
      if (!session.user) {
        const auth = jwtAuthenticator(env.publicKeyThumbprint, createGetVerificationData(publicKey, jwtSaasIssuer)(env))
        const result = await auth(req.raw)
        if (!result.isAuthenticated) {
          return await res.header('Access-Control-Allow-Origin', SAAS_BASE_URL)
            .redirect(`${SAAS_BASE_URL}/api/auth/login?redirectTo=${encodeURIComponent(`${loginUrl}?env=${envId}&returnPath=${returnPath}`)}`)
        }
        session.set(result.claims)
        session.save()
      }
      return await res.redirect(new URL(returnPath, replaceHostname(baseUrl, `${envId}.${baseUrl.hostname}`)).toString())
    })
    .get('/healthz', { logLevel: 'warn' }, async () => 'OK')
