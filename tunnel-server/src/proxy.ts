import httpProxy from 'http-proxy'
import { IncomingMessage, ServerResponse } from 'http'
import net from 'net'
import internal from 'stream'
import type { Logger } from 'pino'
import { inspect } from 'util'
import { KeyObject } from 'crypto'
import { ActiveTunnel, ActiveTunnelStore } from './tunnel-store'
import { requestsCounter } from './metrics'
import { Claims, jwtAuthenticator, AuthenticationResult, AuthError, createGetVerificationData } from './auth'
import { SessionStore } from './session'
import { BadGatewayError, BadRequestError, BasicAuthUnauthorizedError, NotFoundError, RedirectError, UnauthorizedError, errorHandler, errorUpgradeHandler, tryHandler, tryUpgradeHandler } from './http-server-helpers'

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

const tunnelUrlRe = /^\/?([^/]+)\/([^/]+)\/([^/]+)(\/.*)/
const parseTunnelPath = (path: string) => {
  const match = tunnelUrlRe.exec(path)
  return match && {
    pkThumbprint: match[1],
    tunnel: match[2],
    reqType: match[3],
    path: match[4] as `/${string}` | undefined,
  }
}

const proxyRequestType = 'proxy' as const

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
  const loginRedirectUrlForRequest = loginRedirectUrl(loginUrl)

  const extractActiveTunnelFromReqHostname = async ({ headers, url }: Pick<IncomingMessage, 'headers' | 'url'>) => {
    const host = headers.host?.split(':')?.[0]
    const firstHostnameLabel = host?.split('.', 1)[0] as string
    const activeTunnel = await activeTunnelStore.get(firstHostnameLabel)
    return activeTunnel
      ? { reqType: proxyRequestType, path: url, activeTunnel }
      : undefined
  }

  const extractActiveTunnelFromPath = async ({ url, headers, method }: Pick<IncomingMessage, 'url' | 'headers' | 'method'>) => {
    if (!url) {
      log.warn('no url for request: %j', { url, host: headers.host, method })
      return undefined
    }
    const parsedPath = parseTunnelPath(url)
    if (!parsedPath) {
      return undefined
    }
    const { pkThumbprint, tunnel, reqType, path } = parsedPath
    const tunnels = await activeTunnelStore.getByPkThumbprint(pkThumbprint)
    const activeTunnel = tunnels?.find(t => t.tunnelPath === tunnel)
    return activeTunnel
      ? { reqType, path, activeTunnel }
      : undefined
  }

  const extractActiveTunnelFromReq = async (
    req: IncomingMessage
  ) => await extractActiveTunnelFromReqHostname(req) ?? await extractActiveTunnelFromPath(req)

  const validatePrivateTunnelRequest = async (
    req: IncomingMessage,
    tunnel: Pick<ActiveTunnel, 'publicKeyThumbprint' | 'hostname' | 'publicKey'>,
    session: ReturnType<typeof sessionStore>,
  ) => {
    if (!session.user) {
      const redirectoToLoginError = () => new RedirectError(
        307,
        loginRedirectUrlForRequest({ env: tunnel.hostname, returnPath: req.url }),
      )

      if (!req.headers.authorization) {
        throw req.url !== undefined && hasBasicAuthQueryParamHint(req.url)
          ? new BasicAuthUnauthorizedError()
          : redirectoToLoginError()
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
          log.warn('Auth error %j', inspect(e))
          throw new BadRequestError(`Auth error: ${e.message}`, e)
        }
        throw e
      }

      if (!authResult.isAuthenticated) {
        throw redirectoToLoginError()
      }

      session.set(authResult.claims)
      if (authResult.login && req.method === 'GET') {
        session.save()
        throw redirectoToLoginError()
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
    req: IncomingMessage,
    session: (pkThumbprint: string) => ReturnType<typeof sessionStore>,
  ) => {
    const found = await extractActiveTunnelFromReq(req)
    if (!found) {
      log.warn('no active tunnel for %j', { url: req.url, method: req.method, host: req.headers?.host })
      throw new BadGatewayError('No active tunnel found')
    }

    const { activeTunnel, reqType, path } = found
    if (reqType !== proxyRequestType) {
      log.warn('invalid request type %s: %j', { url: req.url, method: req.method, host: req.headers?.host })
      throw new NotFoundError('Request type not found')
    }

    req.url = path ?? '/'

    if (activeTunnel.access === 'private') {
      return {
        req: await validatePrivateTunnelRequest(req, activeTunnel, session(activeTunnel.publicKeyThumbprint)),
        activeTunnel,
      }
    }

    return { req, activeTunnel }
  }

  return {
    handler: tryHandler({ log }, async (req: IncomingMessage, res: ServerResponse<IncomingMessage>) => {
      const { req: mutatedReq, activeTunnel } = await validateProxyRequest(
        req,
        pkThumbprint => sessionStore(req, res, pkThumbprint),
      )

      log.debug('proxying to %j', { target: activeTunnel.target, url: req.url })
      requestsCounter.inc({ clientId: activeTunnel.clientId })

      return proxy.web(
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
    }),

    upgradeHandler: tryUpgradeHandler({ log }, async (req: IncomingMessage, socket: internal.Duplex, head: Buffer) => {
      const { req: mutatedReq, activeTunnel } = await validateProxyRequest(
        req,
        pkThumbprint => sessionStore(req, undefined as unknown as ServerResponse, pkThumbprint),
      )

      const upgrade = mutatedReq.headers.upgrade?.toLowerCase()

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
