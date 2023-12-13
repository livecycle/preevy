import fs from 'node:fs'
import { FastifyPluginAsync } from 'fastify'
import { SshState } from '../ssh/index.js'

export const env: FastifyPluginAsync<{
  currentSshState: () => Promise<SshState>
  machineStatus?: () => Promise<{ data: Buffer; contentType: string }>
  envMetadata?: Record<string, unknown>
  composeModelPath: string
}> = async (app, { currentSshState, machineStatus, envMetadata, composeModelPath }) => {
  app.get('/tunnels', async () => await currentSshState())

  if (machineStatus) {
    app.get('/machine-status', async (_req, res) => {
      const { data, contentType } = await machineStatus()
      void res
        .header('Content-Type', contentType)
        .send(data)
    })
  }

  if (envMetadata) {
    app.get('/env-metadata', async () => envMetadata)
  }

  app.get('/compose-model', async ({ log }, res) => {
    log.debug('compose-model handler')
    void res
      .header('Content-Type', 'application/x-yaml')
      .send(await fs.promises.readFile(composeModelPath, { encoding: 'utf-8' }))
  })
}
