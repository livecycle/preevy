import { FastifyPluginAsync } from 'fastify'
import { NotFoundError } from './errors'
import { Static, Type } from '@sinclair/typebox'
import { PreviewEnvStore } from './preview-env'

const addRouteBody = Type.Object({
  serviceHostSuffix: Type.String(),
  target: Type.String(),
})

export const apiRoutes: FastifyPluginAsync<{ envStore: PreviewEnvStore }> = async (app, { envStore }) => {
  app
    .delete<{ Params: { targetHost: string } }>('routes/:targetHost', async (req, res) => {
      const { targetHost } = req.params
      if (!(await envStore.delete(targetHost))) {
        throw new NotFoundError(`host ${targetHost}`)
      }
      return res.send('')
    })
    .post<{
      Body: Static<typeof addRouteBody>
      Params: { targetHost: string }
    }>('routes/:targetHost', { schema: { body: addRouteBody } }, async (req, res) => {
      const { targetHost } = req.params
      const { serviceHostSuffix, target } = req.body
      await envStore.set(targetHost, { serviceHostSuffix, target })
      return res.send('')
    })
}
