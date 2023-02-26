import { FastifyPluginAsync, HTTPMethods } from 'fastify'
import { PreviewEnvStore } from './preview-env'
import { NotFoundError } from './errors'
import httpProxy from 'http-proxy'

const ALL_METHODS = Object.freeze(['DELETE', 'GET', 'HEAD', 'PATCH', 'POST', 'PUT', 'OPTIONS']) as HTTPMethods[]

export const proxyRoutes: FastifyPluginAsync<{ envStore: PreviewEnvStore }> = async (app, { envStore }) => {
  const proxy = httpProxy.createProxy({
    autoRewrite: true,
  })

  app.addHook('onClose', () => proxy.close())

  app.route<{
    Params: { targetHost: string; targetService: string; ['*']: string }
  }>({
    url: ':targetHost/:targetService/*',
    method: ALL_METHODS,
    handler: async (req, res) => {
      const { targetHost, targetService, ['*']: url } = req.params
      req.log.debug('proxy request', { targetHost, targetService, url })
      const env = await envStore.get(targetHost)

      if (!env) {
        throw new NotFoundError(`host ${targetHost}`)
      }

      const host = `${targetService}${env.serviceHostSuffix}`
      req.log.info(`host: ${host}`)
      req.raw.url = `/${url}`

      proxy.web(req.raw, res.raw, {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        target: {
          socketPath: env.target,
        },
        headers: { Host: host },
      }, (err) => {
        req.log.warn('error in proxy %j', err, { targetHost, targetService, url })
      })

      return res
    },
  })
}
