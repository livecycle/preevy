import Fastify from 'fastify'
import { fastifyRequestContext } from '@fastify/request-context'
import http from 'http'
import { Logger } from 'pino'
import { KeyObject } from 'crypto'
import { SessionStore } from './session'
import { Claims, cliIdentityProvider, jwtAuthenticator, saasIdentityProvider } from './auth'
import { ActiveTunnelStore } from './tunnel-store'
import { editUrl } from './url'
import { Proxy } from './proxy'

const { SAAS_BASE_URL } = process.env
if (SAAS_BASE_URL === undefined) { throw new Error('Env var SAAS_BASE_URL is missing') }

export const app = ({ proxy, sessionStore, baseUrl, activeTunnelStore, log, loginUrl, saasPublicKey, jwtSaasIssuer }: {
  log: Logger
  baseUrl: URL
  loginUrl: string
  sessionStore: SessionStore<Claims>
  activeTunnelStore: ActiveTunnelStore
  proxy: Proxy
  saasPublicKey: KeyObject
  jwtSaasIssuer: string
}) => {
  const saasIdp = saasIdentityProvider(jwtSaasIssuer, saasPublicKey)
  return Fastify({
    serverFactory: handler => {
      const baseHostname = baseUrl.hostname
      const authHostname = `auth.${baseHostname}`
      const apiHostname = `api.${baseHostname}`

      const isNonProxyRequest = ({ headers }: http.IncomingMessage) => {
        const host = headers.host?.split(':')?.[0]
        return (host === authHostname) || (host === apiHostname)
      }

      const server = http.createServer((req, res) => {
        if (req.url !== '/healthz') {
          log.debug('request %j', { method: req.method, url: req.url, headers: req.headers })
        }
        const proxyHandler = !isNonProxyRequest(req) && proxy.routeRequest(req)
        return proxyHandler ? proxyHandler(req, res) : handler(req, res)
      })
        .on('upgrade', (req, socket, head) => {
          log.debug('upgrade', req.url)
          const proxyHandler = !isNonProxyRequest(req) && proxy.routeUpgrade(req)
          if (proxyHandler) {
            return proxyHandler(req, socket, head)
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
      const activeTunnelEntry = await activeTunnelStore.get(envId)
      if (!activeTunnelEntry) {
        res.statusCode = 404
        return { error: 'unknown envId' }
      }
      const { value: activeTunnel } = activeTunnelEntry
      const session = sessionStore(req.raw, res.raw, activeTunnel.publicKeyThumbprint)
      if (!session.user) {
        const auth = jwtAuthenticator(
          activeTunnel.publicKeyThumbprint,
          [saasIdp, cliIdentityProvider(activeTunnel.publicKey, activeTunnel.publicKeyThumbprint)]
        )
        const result = await auth(req.raw)
        if (!result.isAuthenticated) {
          return await res.header('Access-Control-Allow-Origin', SAAS_BASE_URL)
            .redirect(`${SAAS_BASE_URL}/api/auth/login?redirectTo=${encodeURIComponent(`${loginUrl}?env=${envId}&returnPath=${returnPath}`)}`)
        }
        session.set(result.claims)
        session.save()
      }
      return await res.redirect(new URL(returnPath, editUrl(baseUrl, { hostname: `${envId}.${baseUrl.hostname}` })).toString())
    })
    .get<{Params: { profileId: string } }>('/profiles/:profileId/tunnels', { schema: {
      params: { type: 'object',
        properties: {
          profileId: { type: 'string' },
        },
        required: ['profileId'] },
    } }, async (req, res) => {
      const { profileId } = req.params
      const tunnels = (await activeTunnelStore.getByPkThumbprint(profileId))
      if (!tunnels?.length) return []

      const auth = jwtAuthenticator(
        profileId,
        [saasIdp, cliIdentityProvider(tunnels[0].publicKey, tunnels[0].publicKeyThumbprint)]
      )

      const result = await auth(req.raw)

      if (!result.isAuthenticated) {
        res.statusCode = 401
        return await res.send('Unauthenticated')
      }

      return await res.send(tunnels.map(t => ({
        envId: t.envId,
        hostname: t.hostname,
        access: t.access,
        meta: t.meta,
      })))
    })

    .get('/healthz', { logLevel: 'warn' }, async () => 'OK')
}
