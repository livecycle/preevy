import httpProxy from 'http-proxy'
import { IncomingMessage } from 'http'
import net from 'net'
import type { Logger } from 'pino'
import { inspect } from 'util'
import { KeyObject } from 'crypto'
import stream from 'stream'
import { ActiveTunnel, ActiveTunnelStore } from '../tunnel-store/index.js'
import { requestsCounter } from '../metrics.js'
import { Claims, AuthenticationResult, AuthError, Authenticator } from '../auth.js'
import { SessionStore } from '../session.js'
import { BadGatewayError, BadRequestError, BasicAuthUnauthorizedError, RedirectError, UnauthorizedError, errorHandler, errorUpgradeHandler, tryHandler, tryUpgradeHandler } from '../http-server-helpers.js'
import { TunnelFinder, proxyRouter } from './router.js'
import { proxyInjectionHandlers } from './injection/index.js'

const hasBasicAuthQueryParamHint = (url: string) =>
  new URL(url, 'http://a').searchParams.get('_preevy_auth_hint') === 'basic'

export const proxy = ({
  activeTunnelStore,
  baseHostname,
  sessionStore,
  log,
  authFactory,
  loginUrl,
}: {
  sessionStore: SessionStore<Claims>
  activeTunnelStore: Pick<ActiveTunnelStore, 'get'>
  baseHostname: string
  log: Logger
  authFactory: (client: { publicKey: KeyObject; publicKeyThumbprint: string }) => Authenticator
  loginUrl: ({ env, returnPath }: { env: string; returnPath?: string }) => string
}) => {
  const theProxy = httpProxy.createProxyServer({ xfwd: true })
  const injectionHandlers = proxyInjectionHandlers({ log })
  theProxy.on('proxyRes', injectionHandlers.proxyResHandler)
  theProxy.on('proxyReq', injectionHandlers.proxyReqHandler)

  const validatePrivateTunnelRequest = async (
    req: IncomingMessage,
    tunnel: Pick<ActiveTunnel, 'publicKeyThumbprint' | 'hostname' | 'publicKey'>,
    session: ReturnType<typeof sessionStore>,
  ) => {
    if (!session.user) {
      const redirectToLoginError = () => new RedirectError(
        307,
        loginUrl({ env: tunnel.hostname, returnPath: req.url }),
      )

      const authenticate = authFactory(tunnel)

      let authResult: AuthenticationResult
      try {
        authResult = await authenticate(req)
      } catch (e) {
        if (e instanceof AuthError) {
          log.warn('Auth error %j', inspect(e))
          throw new BadRequestError(`Auth error: ${e.message}`, e)
        }
        throw e
      }

      if (!authResult.isAuthenticated) {
        log.debug('not authenticated: %j', authResult.reason)
        throw req.url !== undefined && hasBasicAuthQueryParamHint(req.url)
          ? new BasicAuthUnauthorizedError()
          : redirectToLoginError()
      }

      session.set(authResult.claims)
      if (authResult.login && req.method === 'GET' && !req.headers.upgrade) {
        session.save()
        throw redirectToLoginError()
      }

      if (authResult.method.type === 'header') {
        delete req.headers[authResult.method.header]
      }
    }

    if (session.user?.role !== 'admin') {
      log.info('Non admin role tried to access private environment %j', session.user?.role)
      throw new UnauthorizedError()
    }

    return req
  }

  const validateProxyRequest = async (
    findTunnel: TunnelFinder,
    req: IncomingMessage,
    session: (pkThumbprint: string) => ReturnType<typeof sessionStore>
  ) => {
    const found = await findTunnel(activeTunnelStore)
    if (!found) {
      log.warn('no active tunnel for %j', { url: req.url, method: req.method, host: req.headers?.host })
      throw new BadGatewayError('No active tunnel found')
    }

    const { activeTunnel, path } = found

    req.url = path ?? '/'

    if (activeTunnel.access === 'private' && req.method !== 'OPTIONS') {
      return {
        req: await validatePrivateTunnelRequest(req, activeTunnel, session(activeTunnel.publicKeyThumbprint)),
        activeTunnel,
      }
    }

    return { req, activeTunnel }
  }

  const handler = (tunnelFinder: TunnelFinder) => tryHandler({ log }, async (req, res) => {
    const { req: mutatedReq, activeTunnel } = await validateProxyRequest(
      tunnelFinder,
      req,
      pkThumbprint => sessionStore(req, res, pkThumbprint),
    )

    log.debug('proxying to %j', { target: activeTunnel.target, url: req.url })
    requestsCounter.inc({ clientId: activeTunnel.clientId })

    injectionHandlers.setInjectsForReq(mutatedReq, activeTunnel.inject)

    return theProxy.web(
      mutatedReq,
      res,
      {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        target: {
          socketPath: activeTunnel.target,
        },
        selfHandleResponse: true, // handled by the onProxyRes hook
      },
      err => errorHandler(log, err, req, res)
    )
  })

  const upgradeHandler = (tunnelFinder: TunnelFinder) => tryUpgradeHandler(
    { log },
    async (req: IncomingMessage, socket: stream.Duplex, head: Buffer) => {
      const { req: mutatedReq, activeTunnel } = await validateProxyRequest(
        tunnelFinder,
        req,
        pkThumbprint => sessionStore(req, undefined, pkThumbprint),
      )

      const upgrade = mutatedReq.headers.upgrade?.toLowerCase()

      if (upgrade === 'websocket') {
        return theProxy.ws(
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
    },
  )

  const router = proxyRouter({ log, baseHostname })

  return {
    routeRequest: (req: IncomingMessage) => {
      const findTunnel = router(req)
      return findTunnel && handler(findTunnel)
    },
    routeUpgrade: (req: IncomingMessage) => {
      const findTunnel = router(req)
      return findTunnel && upgradeHandler(findTunnel)
    },
  }
}

export type Proxy = ReturnType<typeof proxy>
