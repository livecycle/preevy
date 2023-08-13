import { Logger } from 'pino'
import { createPublicKey } from 'crypto'
import { calculateJwkThumbprintUri, exportJWK } from 'jose'
import { inspect } from 'util'
import { Gauge } from 'prom-client'
import { baseSshServer } from './base-server'
import { PreviewEnvStore } from '../preview-env'

export const createSshServer = ({
  log,
  sshPrivateKey,
  socketDir,
  envStore,
  envStoreKey,
  tunnelUrl,
  helloBaseResponse,
  tunnelsGauge,
}: {
  log: Logger
  sshPrivateKey: string
  socketDir: string
  envStore: PreviewEnvStore
  envStoreKey: (clientId: string, remotePath: string) => string
  tunnelUrl: (clientId: string, remotePath: string) => string
  helloBaseResponse: Record<string, unknown>
  tunnelsGauge: Pick<Gauge, 'inc' | 'dec'>
}) => baseSshServer({
  log,
  sshPrivateKey,
  socketDir,
})
  .on('client', client => {
    const { clientId, publicKey, envId } = client
    const tunnels = new Map<string, string>()
    client
      .on('forward', async (requestId, { path: remotePath, access }, accept, reject) => {
        const key = envStoreKey(clientId, remotePath)
        if (await envStore.has(key)) {
          reject(new Error(`duplicate path: ${key}`))
          return
        }
        const forward = await accept()
        const pk = createPublicKey(publicKey.getPublicPEM())

        log.debug('creating tunnel %s for localSocket %s', key, forward.localSocketPath)
        await envStore.set(key, {
          envId,
          target: forward.localSocketPath,
          clientId,
          publicKey: pk,
          access,
          hostname: key,
          publicKeyThumbprint: await calculateJwkThumbprintUri(await exportJWK(pk)),
        })
        tunnels.set(requestId, tunnelUrl(clientId, remotePath))
        tunnelsGauge.inc({ clientId })

        forward.on('close', () => {
          log.debug('deleting tunnel %s', key)
          tunnels.delete(requestId)
          void envStore.delete(key)
          tunnelsGauge.dec({ clientId })
        })
      })
      .on('error', err => { log.warn('client error %j: %j', clientId, inspect(err)) })
      .on('exec', (command, respondWithJson, reject) => {
        if (command === 'hello') {
          respondWithJson({
            clientId,
            tunnels: Object.fromEntries(tunnels.entries()),
            ...helloBaseResponse,
          })
          return undefined
        }

        if (command.startsWith('tunnel-url ')) {
          const [, ...requestedTunnels] = command.split(' ')
          respondWithJson(Object.fromEntries(
            requestedTunnels.filter(Boolean).map(requestedTunnel => [
              requestedTunnel,
              tunnelUrl(clientId, requestedTunnel),
            ]),
          ))
          return undefined
        }

        log.warn('invalid command: %j', command)
        reject()
        return undefined
      })
  })
