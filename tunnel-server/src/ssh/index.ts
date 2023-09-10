import { Logger } from 'pino'
import { createPublicKey } from 'crypto'
import { calculateJwkThumbprintUri, exportJWK } from 'jose'
import { inspect } from 'util'
import { Gauge } from 'prom-client'
import { ClientForward, baseSshServer } from './base-server'
import { ActiveTunnelStore, KeyAlreadyExistsError, TransactionDescriptor, activeTunnelStoreKey } from '../tunnel-store'

export const createSshServer = ({
  log,
  sshPrivateKey,
  socketDir,
  activeTunnelStore,
  tunnelUrl,
  helloBaseResponse,
  tunnelsGauge,
}: {
  log: Logger
  sshPrivateKey: string
  socketDir: string
  activeTunnelStore: ActiveTunnelStore
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
    const pk = createPublicKey(publicKey.getPublicPEM())
    const tunnels = new Map<string, string>()
    const jwkThumbprint = (async () => await calculateJwkThumbprintUri(await exportJWK(pk)))()
    client
      .on('forward', async (requestId, { path: tunnelPath, access, meta, inject }, localSocketPath, accept, reject) => {
        const key = activeTunnelStoreKey(clientId, tunnelPath)
        log.info('creating tunnel %s for localSocket %s', key, localSocketPath)
        const setTx = await activeTunnelStore.set(key, {
          tunnelPath,
          envId,
          target: localSocketPath,
          clientId,
          publicKey: pk,
          access,
          hostname: key,
          publicKeyThumbprint: await jwkThumbprint,
          meta,
          inject,
        }).catch(e => {
          reject(
            e instanceof KeyAlreadyExistsError
              ? new Error(`duplicate path: ${key}, client map contains path: ${tunnels.has(key)}`)
              : new Error(`error setting tunnel ${key}: ${e}`, { cause: e }),
          )
        })
        if (!setTx) {
          return undefined
        }
        const forward = await accept().catch(async e => {
          log.warn('error accepting forward %j: %j', requestId, inspect(e))
          await activeTunnelStore.delete(key, setTx)
        })
        if (!forward) {
          return undefined
        }
        tunnels.set(requestId, tunnelUrl(clientId, tunnelPath))
        forward.on('close', () => {
          log.info('deleting tunnel %s', key)
          tunnels.delete(requestId)
          void activeTunnelStore.delete(key, setTx)
          tunnelsGauge.dec({ clientId })
        })
        tunnelsGauge.inc({ clientId })
        return undefined
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
