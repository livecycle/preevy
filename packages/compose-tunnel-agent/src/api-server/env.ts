import plimit from 'p-limit'
import { FastifyPluginAsync } from 'fastify'
import { SshState } from '../ssh/index.js'

export const env: FastifyPluginAsync<{
  currentSshState: () => Promise<SshState>
  machineStatus?: () => Promise<{ data: Buffer; contentType: string }>
  envMetadata?: Record<string, unknown>
}> = async (app, { currentSshState, machineStatus, envMetadata }) => {
  app.get('/forwards', async () => await currentSshState())

  if (machineStatus) {
    const limit = plimit(1)
    app.get('/machine-status', async (_req, res) => {
      const { data, contentType } = await limit(machineStatus)
      void res
        .header('Content-Type', contentType)
        .send(data)
    })
  }

  if (envMetadata) {
    app.get('/env-metadata', async () => envMetadata)
  }
}
