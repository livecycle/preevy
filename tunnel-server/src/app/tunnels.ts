import { FastifyPluginAsync } from 'fastify'
import { Level, Logger } from 'pino'
import z from 'zod'
import { KeyObject } from 'crypto'
import { ActiveTunnelStore } from '../tunnel-store/index.js'
import { Authenticator } from '../auth.js'
import { NotFoundError, UnauthorizedError } from '../http-server-helpers.js'

const paramsSchema = z.object({
  profileId: z.string(),
})

export const profileTunnels: FastifyPluginAsync<{
  log: Logger<Level>
  activeTunnelStore: Pick<ActiveTunnelStore, 'getByPkThumbprint'>
  authFactory: (client: { publicKey: KeyObject; publicKeyThumbprint: string }) => Authenticator
}> = async (app, { activeTunnelStore, authFactory }) => {
  app.get<{
    Params: z.infer<typeof paramsSchema>
  }>('/profiles/:profileId/tunnels', async (req, res) => {
    const { params: { profileId } } = req
    const tunnels = (await activeTunnelStore.getByPkThumbprint(profileId))
    if (!tunnels?.length) throw new NotFoundError(`Unknown profileId: ${profileId}`)

    const auth = authFactory(tunnels[0])

    const result = await auth(req.raw)

    if (!result.isAuthenticated) {
      throw new UnauthorizedError()
    }

    return await res.send(tunnels.map(t => ({
      envId: t.envId,
      hostname: t.hostname,
      access: t.access,
      meta: t.meta,
    })))
  })
}
