import { Logger } from 'pino'
import { createPublicKey } from 'crypto'
import { calculateJwkThumbprintUri, exportJWK } from 'jose'
import { inspect } from 'util'
import { Gauge } from 'prom-client'
import { baseSshServer } from './base-server'
import { ActiveTunnelStore } from '../tunnel-store'

export const createSshServer = ({
  log,
  sshPrivateKey,
  socketDir,
  activeTunnelStore,
  activeTunnelStoreKey,
  tunnelUrl,
  helloBaseResponse,
  tunnelsGauge,
}: {
  log: Logger
  sshPrivateKey: string
  socketDir: string
  activeTunnelStore: ActiveTunnelStore
  activeTunnelStoreKey: (clientId: string, remotePath: string) => string
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
      .on('forward', async (requestId, { path: tunnelPath, access, meta }, accept, reject) => {
        const key = activeTunnelStoreKey(clientId, tunnelPath)
        if (await activeTunnelStore.has(key)) {
          reject(new Error(`duplicate path: ${key}`))
          return
        }
        const forward = await accept()
        const pk = createPublicKey(publicKey.getPublicPEM())

        log.debug('creating tunnel %s for localSocket %s', key, forward.localSocketPath)
        await activeTunnelStore.set(key, {
          tunnelPath,
          envId,
          target: forward.localSocketPath,
          clientId,
          publicKey: pk,
          access,
          hostname: key,
          publicKeyThumbprint: await calculateJwkThumbprintUri(await exportJWK(pk)),
          meta,
        })
        tunnels.set(requestId, tunnelUrl(clientId, tunnelPath))
        tunnelsGauge.inc({ clientId })

        forward.on('close', () => {
          log.debug('deleting tunnel %s', key)
          tunnels.delete(requestId)
          void activeTunnelStore.delete(key)
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
