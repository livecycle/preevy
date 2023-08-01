import httpProxy from 'http-proxy'
import { IncomingMessage, ServerResponse } from 'http'
import net from 'net'
import internal from 'stream'
import type { Logger } from 'pino'
import { inspect } from 'util'
import { PreviewEnvStore } from './preview-env'
import { requestsCounter } from './metrics'
import { Claims, authenticator, JwtAuthenticator, getIssuerToKeyDataFromEnv, AuthenticationResult, AuthError, UnauthorizedError } from './auth'
import { SessionStore } from './session'
import { BadGatewayError, BadRequestError, errorHandler, errorUpgradeHandler, tryHandler, tryUpgradeHandler } from './http-server-helpers'

export const isProxyRequest = (
  hostname: string,
) => (req: IncomingMessage) => Boolean(req.headers.host?.split(':')?.[0]?.endsWith(`.${hostname}`))

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

export function proxyHandlers({
  envStore,
  loginUrl,
  sessionStore,
  log,
}: {
  sessionStore: SessionStore<Claims>
  envStore: PreviewEnvStore
  loginUrl: string
  log: Logger
}) {
  const proxy = httpProxy.createProxy({})
  const redirectToLogin = loginRedirector(loginUrl)
  const resolveTargetEnv = async (req: IncomingMessage) => {
    const { url } = req
    const host = req.headers.host?.split(':')?.[0]
    const targetHost = host?.split('.', 1)[0]
    const env = await envStore.get(targetHost as string)
    if (!env) {
      log.warn('no env for %j', { targetHost, url })
      return undefined
    }
    return env
  }
  return {
    handler: tryHandler({ log }, async (req: IncomingMessage, res: ServerResponse<IncomingMessage>) => {
      const env = await resolveTargetEnv(req)
      if (!env) {
        throw new BadGatewayError()
      }

      const session = sessionStore(req, res, env.publicKeyThumbprint)
      if (env.access === 'private') {
        if (!session.user) {
          const authenticate = authenticator([
            JwtAuthenticator(getIssuerToKeyDataFromEnv(env, log)),
          ])
          let authResult: AuthenticationResult
          try {
            authResult = await authenticate(req)
          } catch (e) {
            if (e instanceof AuthError) {
              log.warn('Auth error %j', inspect(e))
              throw new BadRequestError(`Auth error: ${e.message}`)
            }
            throw e
          }
          if (!authResult.isAuthenticated) {
            log.debug('unauthorized request: %j %j %j', req.url, req.method, req.headers)
            throw new UnauthorizedError('invalid auth')
          }
          session.set(authResult.claims)
          if (authResult.login && req.method === 'GET') {
            session.save()
            redirectToLogin(res, env.hostname, req.url)
            return undefined
          }
          if (authResult.method.type === 'header') {
            delete req.headers[authResult.method.header]
          }
        }

        if (session.user?.role !== 'admin') {
          throw new UnauthorizedError('not admin')
        }
      }

      log.debug('proxying to %j', { target: env.target, url: req.url })
      requestsCounter.inc({ clientId: env.clientId })

      return proxy.web(
        req,
        res,
        {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          target: {
            socketPath: env.target,
          },
        },
        err => errorHandler(log, err, req, res)
      )
    }),

    upgradeHandler: tryUpgradeHandler({ log }, async (req: IncomingMessage, socket: internal.Duplex, head: Buffer) => {
      const env = await resolveTargetEnv(req)
      if (!env) {
        log.warn('env not found for upgrade %j', req.url)
        throw new BadGatewayError()
      }

      log.debug('upgrade handler %j', { url: req.url, env, headers: req.headers })

      if (env.access === 'private') {
        const session = sessionStore(req, undefined as any, env.publicKeyThumbprint)
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
              socketPath: env.target,
            },
          },
          err => errorUpgradeHandler(log, err, req, socket)
        )
      }

      if (upgrade === 'tcp') {
        const targetSocket = net.createConnection({ path: env.target }, () => {
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
