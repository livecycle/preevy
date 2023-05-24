import { PreviewEnvStore } from './preview-env'
import httpProxy from 'http-proxy'
import { IncomingMessage, ServerResponse } from 'http'
import internal from 'stream'
import type { Logger } from 'pino'
import { requestsCounter } from './metrics'

export const isProxyRequest = (
  hostname: string,
) => (req: IncomingMessage)=> Boolean(req.headers.host?.split(':')?.[0]?.endsWith(`.${hostname}`))

function asyncHandler<TArgs extends unknown[]>(fn: (...args: TArgs) => Promise<void>, onError: (error: unknown, ...args: TArgs)=> void ) {
  return async (...args: TArgs) => {
    try {
      await fn(...args)
    } catch (err) {
      onError(err, ...args)
    }
  }
}

const unauthorized = (res: ServerResponse<IncomingMessage>) => {
  res.setHeader('WWW-Authenticate', 'Basic realm="Secure Area"');
  res.statusCode = 401;
  res.end('Unauthorized');
}

export function proxyHandlers({
  envStore,
  logger
}: {
  envStore: PreviewEnvStore
  logger: Logger
} ){
  const proxy = httpProxy.createProxy({})
  const resolveTargetEnv = async (req: IncomingMessage)=>{
    const {url} = req
    const host = req.headers['host']?.split(':')?.[0]
    const targetHost = host?.split('.', 1)[0]
    const env = await envStore.get(targetHost as string)
    if (!env) {
      logger.warn('no env for %j', { targetHost, url })
      return
    }
    return env
  }
  return {
    handler: asyncHandler(async (req: IncomingMessage, res: ServerResponse<IncomingMessage>) => {
      const env = await resolveTargetEnv(req)
      if (!env) {
        res.statusCode = 502;
        res.end();
        return;
      }

      if(env.access === 'private'){
        const authorization = req.headers['authorization'];
        if (!(authorization && authorization.startsWith('Basic '))) {
          return unauthorized(res)
        }

        const basicAuth = Buffer.from(authorization?.split('Basic ')[1] || '', 'base64').toString('ascii');
        const [username, password] = basicAuth.split(':');
        if (username !== 'x-preevy-profile-key'){
          return unauthorized(res)
        }
        const signature = Buffer.from(password, 'base64');
        const isAuthenticated = env.publicKey.verify(username, signature)
        if (!isAuthenticated) {
          return unauthorized(res)
        }
      }

      logger.debug('proxying to %j', { target: env.target, url: req.url })
      requestsCounter.inc({clientId: env.clientId})

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
        (err) => {
          logger.warn('error in proxy %j', { error: err, targetHost: env.target, url: req.url })
          res.statusCode = 502
          res.end(`error proxying request: ${(err as unknown as { code: unknown }).code}`)
        }
      )
    }, (err)=> logger.error('error forwarding traffic %j', {error:err}) ),
    wsHandler: asyncHandler(async (req: IncomingMessage, socket: internal.Duplex, head: Buffer) => {
      const env = await resolveTargetEnv(req)
      if (!env) {
        socket.end();
        return;
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
        (err) => {
          logger.warn('error in ws proxy %j', { error:err, targetHost: env.target,  url: req.url })
        }
      )

    }, (err)=> logger.error('error forwarding ws traffic %j', {error: err}))
  }
}