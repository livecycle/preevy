import { FastifyPluginAsync } from 'fastify'
import { Logger } from 'pino'
import z from 'zod'
import { KeyObject } from 'crypto'
import { ActiveTunnelStore } from '../tunnel-store/index.js'
import { NotFoundError, UnauthorizedError } from '../http-server-helpers.js'
import { SessionStore } from '../session.js'
import { Claims, Authenticator } from '../auth.js'
import { editUrl } from '../url.js'
import { calcSaasLoginUrl } from './urls.js'

const loginQueryString = z.object({
  env: z.string(),
  returnPath: z.string().startsWith('/', 'must be an absolute path').optional(),
})

export const login: FastifyPluginAsync<{
  log: Logger
  activeTunnelStore: Pick<ActiveTunnelStore, 'get'>
  sessionStore: SessionStore<Claims>
  baseUrl: URL
  saasBaseUrl?: URL
  authFactory: (client: { publicKey: KeyObject; publicKeyThumbprint: string }) => Authenticator
}> = async (
  app,
  { activeTunnelStore, sessionStore, saasBaseUrl, baseUrl, authFactory },
) => {
  app.get<{
    Querystring: z.infer<typeof loginQueryString>
  }>('/login', {
    schema: {
      querystring: loginQueryString,
    },
  }, async (req, res) => {
    const { query: { env: envId, returnPath } } = req
    const activeTunnelEntry = await activeTunnelStore.get(envId)
    if (!activeTunnelEntry) {
      throw new NotFoundError(`Unknown envId: ${envId}`)
    }
    const { value: activeTunnel } = activeTunnelEntry
    const session = sessionStore(req.raw, res.raw, activeTunnel.publicKeyThumbprint)
    if (!session.user) {
      const auth = authFactory(activeTunnel)
      const result = await auth(req.raw)
      if (!result.isAuthenticated) {
        if (saasBaseUrl) {
          const redirectUrl = calcSaasLoginUrl({ baseUrl, saasBaseUrl, env: envId, returnPath })
          return await res.header('Access-Control-Allow-Origin', saasBaseUrl).redirect(redirectUrl)
        }
        throw new UnauthorizedError()
      }
      session.set(result.claims)
      session.save()
    }
    const envBaseUrl = editUrl(baseUrl, { hostname: `${envId}.${baseUrl.hostname}` })
    const redirectTo = new URL(returnPath ?? '/', envBaseUrl)
    return await res.redirect(redirectTo.toString())
  })
}
