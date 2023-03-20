import { PreviewEnvStore } from './preview-env'
import httpProxy from 'http-proxy'
import { IncomingMessage, ServerResponse } from 'http'
import internal from 'stream'
import type { Logger } from 'pino'

export const isProxyRequest = (baseUrl: {hostname:string, port:string}) => (req: IncomingMessage)=> {
  const host = req.headers["host"]
  if (!host) return false
  const {hostname: reqHostname, port: reqPort} = new URL(`http://${host}`)
  if (reqPort !== baseUrl.port) return false
  return reqHostname.endsWith(`.${baseUrl.hostname}`) && reqHostname !== baseUrl.hostname
}

function asyncHandler<TArgs extends unknown[]>(fn: (...args: TArgs) => Promise<void>, onError: (error: unknown, ...args: TArgs)=> void ) {
  return async (...args: TArgs) => {
    try {
      await fn(...args)
    } catch (err) {
      onError(err, ...args)
    }
  }
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
    const host = req.headers['host']
    const targetHost = host?.split('.', 1)[0]
    const env = await envStore.get(targetHost as string)
    if (!env) {
      logger.warn('no env for %j', { targetHost, url })
      logger.warn('no host header in request')
      return;
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

      logger.info('proxying to %j', { target: env.target, url: req.url })

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