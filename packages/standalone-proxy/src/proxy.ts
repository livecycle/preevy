import { PreviewEnvStore } from './preview-env'
import httpProxy from 'http-proxy'
import { IncomingMessage, ServerResponse } from 'http'
import internal from 'stream'

export const isProxyRequest = (baseUrl: {hostname:string, port:string}) => (req: IncomingMessage)=> {
  const host = req.headers["host"]
  if (!host) return false
  const {hostname: reqHostname, port: reqPort} = new URL(`http://${host}`)
  if (reqPort !== baseUrl.port) return false
  return reqHostname.endsWith(baseUrl.hostname) && reqHostname !== baseUrl.hostname
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

export function proxyHandlers(envStore: PreviewEnvStore, log=console){
  const proxy = httpProxy.createProxy({})
  const resolveTargetEnv = async (req: IncomingMessage)=>{
    const {url} = req
    const host = req.headers['host']
    const targetHost = host?.split('.', 1)[0]
    const env = await envStore.get(targetHost as string)
    if (!env) {
      log.warn('no env for %j', { targetHost, url })
      log.warn('no host header in request')
      return;
    }
    return env
  }
  return {
    handler: asyncHandler(async (req: IncomingMessage, res: ServerResponse<IncomingMessage>) => {
      const env = await resolveTargetEnv(req)
      if (!env) {
        req.statusCode = 520;
        return;
      }

      log.info('proxying to %j', { target: env.target, url: req.url })
      
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
          log.warn('error in proxy %j', err, { targetHost: env.target,  url: req.url })
        }
      )
    }, (err)=> log.error('error in proxy %j', err) ),
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
          log.warn('error in proxy %j', err, { targetHost: env.target, url: req.url })
        }
      )

    }, (err)=> log.error('error forwarding ws traffic %j', err))
  }
}