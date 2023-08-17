import httpProxy from 'http-proxy'
import { IncomingMessage, ServerResponse } from 'http'
import net from 'net'
import internal from 'stream'
import type { Logger } from 'pino'
import { inspect } from 'util'
import { KeyObject } from 'crypto'
import { ActiveTunnel, ActiveTunnelStore } from './preview-env'
import { requestsCounter } from './metrics'
import { Claims, jwtAuthenticator, AuthenticationResult, AuthError, UnauthorizedError, basicAuthUnauthorized, createGetVerificationData } from './auth'
import { SessionStore } from './session'
import { BadGatewayError, BadRequestError, errorHandler, errorUpgradeHandler, tryHandler, tryUpgradeHandler } from './http-server-helpers'

function loginRedirector(loginUrl:string) {
  return (res: ServerResponse<IncomingMessage>, env: string, returnPath?: string) => {
    res.statusCode = 307
    const url = new URL(loginUrl)
    url.searchParams.set('env', env)
    if (returnPath) {
      url.searchParams.set('returnPath', returnPath)
    }

    res.setHeader('location', url.toString())
    res.end()
  }
}

const hasBasicAuthQueryParamHint = (url: string) =>
  new URL(url, 'http://a').searchParams.get('_preevy_auth_hint') === 'basic'

export function proxyHandlers({
  activeTunnelStore,
  loginUrl,
  sessionStore,
  log,
  publicKey,
  jwtSaasIssuer,
}: {
  sessionStore: SessionStore<Claims>
  activeTunnelStore: ActiveTunnelStore
  loginUrl: string
  log: Logger
  publicKey: KeyObject
  jwtSaasIssuer: string
}) {
  const proxy = httpProxy.createProxy({})
  const redirectToLogin = loginRedirector(loginUrl)
  const findActiveTunnelForRequest = async (req: IncomingMessage) => {
    const { url } = req
    const host = req.headers.host?.split(':')?.[0]
    const targetHost = host?.split('.', 1)[0]
    const activeTunnel = await activeTunnelStore.get(targetHost as string)
    if (!activeTunnel) {
      log.warn('no env for %j', { targetHost, url })
      return undefined
    }
    return activeTunnel
  }

  const validatePrivateTunnelRequest = async (
    req: IncomingMessage,
    res: ServerResponse<IncomingMessage>,
    tunnel: Pick<ActiveTunnel, 'publicKeyThumbprint' | 'hostname' | 'publicKey'>,
    session: ReturnType<typeof sessionStore>,
  ) => {
    if (!session.user) {
      if (!req.headers.authorization) {
        return req.url !== undefined && hasBasicAuthQueryParamHint(req.url)
          ? basicAuthUnauthorized(res)
          : redirectToLogin(res, tunnel.hostname, req.url)
      }

      const authenticate = jwtAuthenticator(
        tunnel.publicKeyThumbprint,
        createGetVerificationData(publicKey, jwtSaasIssuer)(tunnel)
      )

      let authResult: AuthenticationResult
      try {
        authResult = await authenticate(req)
      } catch (e) {
        if (e instanceof AuthError) {
          res.statusCode = 400
          log.warn('Auth error %j', inspect(e))
          res.end(`Auth error: ${e.message}`)
          return undefined
        }
        throw e
      }

      if (!authResult.isAuthenticated) {
        redirectToLogin(res, tunnel.hostname, req.url)
        return undefined
      }

      session.set(authResult.claims)
      if (authResult.login && req.method === 'GET') {
        session.save()
        redirectToLogin(res, tunnel.hostname, req.url)
        return undefined
      }
      if (authResult.method.type === 'header') {
        delete req.headers[authResult.method.header]
      }
    }

    if (session.user?.role !== 'admin') {
      log.info('Non admin role tried to access private environment %j', session.user?.role)
      res.statusCode = 403
      res.end('Not allowed')
      return undefined
    }

    return true
  }

  return {
    handler: tryHandler({ log }, async (req: IncomingMessage, res: ServerResponse<IncomingMessage>) => {
      const activeTunnel = await findActiveTunnelForRequest(req)
      if (!activeTunnel) {
        throw new BadGatewayError()
      }

      if (activeTunnel.access === 'private') {
        const session = sessionStore(req, res, activeTunnel.publicKeyThumbprint)
        if (!await validatePrivateTunnelRequest(req, res, activeTunnel, session)) {
          return undefined
        }
      }

      log.debug('proxying to %j', { target: activeTunnel.target, url: req.url })
      requestsCounter.inc({ clientId: activeTunnel.clientId })

      return proxy.web(
        req,
        res,
        {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          target: {
            socketPath: activeTunnel.target,
          },
        },
        err => errorHandler(log, err, req, res)
      )
    }),

    upgradeHandler: tryUpgradeHandler({ log }, async (req: IncomingMessage, socket: internal.Duplex, head: Buffer) => {
      const activeTunnel = await findActiveTunnelForRequest(req)
      if (!activeTunnel) {
        log.warn('env not found for upgrade %j', req.url)
        throw new BadGatewayError()
      }

      log.debug('upgrade handler %j', { url: req.url, env: activeTunnel, headers: req.headers })

      if (activeTunnel.access === 'private') {
        const session = sessionStore(req, undefined as any, activeTunnel.publicKeyThumbprint)
        if (session.user?.role !== 'admin') {
          log.debug('unauthorized upgrade - not admin %j %j %j', req.url, req.method, req.headers)
          throw new UnauthorizedError('not admin')
        }
      }

      const upgrade = req.headers.upgrade?.toLowerCase()

      if (upgrade === 'websocket') {
        return proxy.ws(
          req,
          socket,
          head,
          {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            target: {
              socketPath: activeTunnel.target,
            },
          },
          err => errorUpgradeHandler(log, err, req, socket)
        )
      }

      if (upgrade === 'tcp') {
        const targetSocket = net.createConnection({ path: activeTunnel.target }, () => {
          const reqBuf = `${req.method} ${req.url} HTTP/${req.httpVersion}\r\n${Object.entries(req.headers).map(([k, v]) => `${k}: ${v}`).join('\r\n')}\r\n\r\n`
          targetSocket.write(reqBuf)
          targetSocket.write(head)
          socket.pipe(targetSocket).pipe(socket)
        })
        return undefined
      }

      throw new BadRequestError('Unsupported upgrade header')
    }),
  }
}
