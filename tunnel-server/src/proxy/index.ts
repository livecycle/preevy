import httpProxy from 'http-proxy'
import { IncomingMessage, ServerResponse } from 'http'
import net from 'net'
import internal from 'stream'
import type { Logger } from 'pino'
import { inspect } from 'util'
import { KeyObject } from 'crypto'
import { ActiveTunnel, ActiveTunnelStore } from '../tunnel-store'
import { requestsCounter } from '../metrics'
import { Claims, jwtAuthenticator, AuthenticationResult, AuthError, createGetVerificationData } from '../auth'
import { SessionStore } from '../session'
import { BadGatewayError, BadRequestError, BasicAuthUnauthorizedError, RedirectError, UnauthorizedError, errorHandler, errorUpgradeHandler, tryHandler, tryUpgradeHandler } from '../http-server-helpers'
import { TunnelFinder, proxyRouter } from './router'

const loginRedirectUrl = (loginUrl: string) => ({ env, returnPath }: { env: string; returnPath?: string }) => {
  const url = new URL(loginUrl)
  url.searchParams.set('env', env)
  if (returnPath) {
    url.searchParams.set('returnPath', returnPath)
  }
  return url.toString()
}

const hasBasicAuthQueryParamHint = (url: string) =>
  new URL(url, 'http://a').searchParams.get('_preevy_auth_hint') === 'basic'

export const proxy = ({
  activeTunnelStore,
  loginUrl,
  baseHostname,
  sessionStore,
  log,
  saasPublicKey,
  jwtSaasIssuer,
}: {
  sessionStore: SessionStore<Claims>
  activeTunnelStore: ActiveTunnelStore
  loginUrl: string
  baseHostname: string
  log: Logger
  saasPublicKey: KeyObject
  jwtSaasIssuer: string
}) => {
  const theProxy = httpProxy.createProxy({})
  const loginRedirectUrlForRequest = loginRedirectUrl(loginUrl)

  const validatePrivateTunnelRequest = async (
    req: IncomingMessage,
    tunnel: Pick<ActiveTunnel, 'publicKeyThumbprint' | 'hostname' | 'publicKey'>,
    session: ReturnType<typeof sessionStore>,
  ) => {
    if (!session.user) {
      const redirectToLoginError = () => new RedirectError(
        307,
        loginRedirectUrlForRequest({ env: tunnel.hostname, returnPath: req.url }),
      )

      const authenticate = jwtAuthenticator(
        tunnel.publicKeyThumbprint,
        createGetVerificationData(saasPublicKey, jwtSaasIssuer)(tunnel.publicKey)
      )

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

    if (activeTunnel.access === 'private') {
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

    return theProxy.web(
      mutatedReq,
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
  })

  const upgradeHandler = (tunnelFinder: TunnelFinder) => tryUpgradeHandler(
    { log },
    async (req: IncomingMessage, socket: internal.Duplex, head: Buffer) => {
      const { req: mutatedReq, activeTunnel } = await validateProxyRequest(
        tunnelFinder,
        req,
        pkThumbprint => sessionStore(req, undefined as unknown as ServerResponse, pkThumbprint),
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
