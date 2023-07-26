import httpProxy from 'http-proxy'
import { IncomingMessage, ServerResponse } from 'http'
import net from 'net'
import internal from 'stream'
import type { Logger } from 'pino'
import { inspect } from 'util'
import { PreviewEnvStore } from './preview-env'
import { requestsCounter } from './metrics'
import { Claims, authenticator, JwtAuthenticator, unauthorized, getIssuerToKeyDataFromEnv, AuthenticationResult, AuthError } from './auth'
import { SessionStore } from './session'

export const isProxyRequest = (
  hostname: string,
) => (req: IncomingMessage) => Boolean(req.headers.host?.split(':')?.[0]?.endsWith(`.${hostname}`))

function asyncHandler<TArgs extends unknown[]>(
  fn: (...args: TArgs) => Promise<void>,
  onError: (error: unknown, ...args: TArgs)=> void,
) {
  return async (...args: TArgs) => {
    try {
      await fn(...args)
    } catch (err) {
      onError(err, ...args)
    }
  }
}

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
  sessionManager,
  logger,
}: {
  sessionManager: SessionStore<Claims>
  envStore: PreviewEnvStore
  loginUrl: string
  logger: Logger
}) {
  const proxy = httpProxy.createProxy({})
  const redirectToLogin = loginRedirector(loginUrl)
  const resolveTargetEnv = async (req: IncomingMessage) => {
    const { url } = req
    const host = req.headers.host?.split(':')?.[0]
    const targetHost = host?.split('.', 1)[0]
    const env = await envStore.get(targetHost as string)
    if (!env) {
      logger.warn('no env for %j', { targetHost, url })
      return undefined
    }
    return env
  }
  return {
    handler: asyncHandler(async (req: IncomingMessage, res: ServerResponse<IncomingMessage>) => {
      const env = await resolveTargetEnv(req)
      if (!env) {
        res.statusCode = 502
        res.end()
        return undefined
      }

      const session = sessionManager(req, res, env.publicKeyThumbprint)
      if (env.access === 'private') {
        if (!session.user) {
          const authenticate = authenticator([JwtAuthenticator(getIssuerToKeyDataFromEnv(env, logger))])
          let authResult: AuthenticationResult
          try {
            authResult = await authenticate(req)
          } catch (e) {
            if (e instanceof AuthError) {
              res.statusCode = 400
              logger.warn('Auth error %j', inspect(e))
              res.end(`Auth error: ${e.message}`)
              return undefined
            }
            throw e
          }
          if (!authResult.isAuthenticated) {
            return unauthorized(res)
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
          return unauthorized(res)
        }
      }

      logger.debug('proxying to %j', { target: env.target, url: req.url })
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
        err => {
          logger.warn('error in proxy %j', { error: err, targetHost: env.target, url: req.url })
          res.statusCode = 502
          res.end(`error proxying request: ${(err as unknown as { code: unknown }).code}`)
        }
      )
    }, err => logger.error('error forwarding traffic %j', inspect(err))),

    upgradeHandler: asyncHandler(async (req: IncomingMessage, socket: internal.Duplex, head: Buffer) => {
      const env = await resolveTargetEnv(req)
      if (!env) {
        logger.warn('env not found for upgrade request %j', req.url)
        socket.end()
        return undefined
      }

      logger.debug('upgrade handler %j', { url: req.url, env, headers: req.headers })

      if (env.access === 'private') {
        const session = sessionManager(req, undefined, env.clientId)
        if (session.user?.role !== 'admin') {
          socket.end()
          return undefined
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
          err => {
            logger.warn('error in ws proxy %j', { error: err, targetHost: env.target, url: req.url })
          }
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

      logger.warn('unsupported upgrade: %j', { url: req.url, env, headers: req.headers })
      socket.end()
      return undefined
    }, err => logger.error('error forwarding upgrade traffic %j', { error: err })),
  }
}
