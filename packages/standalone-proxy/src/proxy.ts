import { FastifyPluginAsync, HTTPMethods } from 'fastify'
import { PreviewEnvStore } from './preview-env'
import { NotFoundError } from './errors'
import httpProxy from 'http-proxy'

const ALL_METHODS = Object.freeze(['DELETE', 'GET', 'HEAD', 'PATCH', 'POST', 'PUT', 'OPTIONS']) as HTTPMethods[]

export const proxyRoutes: FastifyPluginAsync<{ envStore: PreviewEnvStore }> = async (app, { envStore }) => {
  const proxy = httpProxy.createProxy({})

  app.addHook('onClose', () => proxy.close())

  // prevent FST_ERR_CTP_INVALID_MEDIA_TYPE error
  app.removeAllContentTypeParsers()
  app.addContentTypeParser('*', function (_request, _payload, done) { done(null) })

  app.route<{
    Params: { targetHost: string; ['*']: string }
  }>({
    url: ':targetHost/*',
    method: ALL_METHODS,
    handler: async (req, res) => {
      const { targetHost, ['*']: url } = req.params
      req.log.debug('proxy request: %j', { targetHost, url, params: req.params })
      const env = await envStore.get(targetHost)

      if (!env) {
        throw new NotFoundError(`host ${targetHost}`)
      }

      req.raw.url = `/${url}`

      proxy.web(
        req.raw,
        res.raw,
        {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          target: {
            socketPath: env.target,
          },
        },
        (err) => {
          req.log.warn('error in proxy %j', err, { targetHost, url })
        }
      )

      return res
    },
  })
}
