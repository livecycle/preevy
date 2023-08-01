import httpProxy from 'http-proxy'
import { IncomingMessage, ServerResponse } from 'http'
import internal from 'stream'
import type { Logger } from 'pino'
import { PreviewEnvStore } from './preview-env'
import { requestsCounter } from './metrics'
import { authenticator, tunnelingKeyAuthenticator } from './auth'

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

const unauthorized = (res: ServerResponse<IncomingMessage>) => {
  res.setHeader('WWW-Authenticate', 'Basic realm="Secure Area"')
  res.statusCode = 401
  res.end('Unauthorized')
}

export function proxyHandlers({
  envStore,
  logger,
}: {
  envStore: PreviewEnvStore
  logger: Logger
}) {
  const proxy = httpProxy.createProxy({})
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

      if (env.access === 'private') {
        const authenticate = authenticator([tunnelingKeyAuthenticator(env.publicKey)])
        try {
          const claims = await authenticate(req)
          if (!claims) {
            return unauthorized(res)
          }
        } catch (error) {
          res.statusCode = 400
          res.end()
          return undefined
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
    }, err => logger.error('error forwarding traffic %j', { error: err })),

    wsHandler: asyncHandler(async (req: IncomingMessage, socket: internal.Duplex, head: Buffer) => {
      const env = await resolveTargetEnv(req)
      if (!env) {
        socket.end()
        return undefined
      }

      if (env.access === 'private') {
        // need to support session cookie, native browser Websocket api doesn't forward authorization header
        socket.end()
        return undefined
      }
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
    }, err => logger.error('error forwarding ws traffic %j', { error: err })),
  }
}
