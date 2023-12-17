import { Logger } from 'pino'
import { inspect } from 'util'
import { Gauge } from 'prom-client'
import lodash from 'lodash-es'
import { BaseSshClient, baseSshServer } from './base-server'
import { ActiveTunnelStore, activeTunnelStoreKey } from '../tunnel-store'
import { KeyAlreadyExistsError } from '../memory-store'
import { onceWithTimeout } from '../events'

export const createSshServer = ({
  log: serverLog,
  sshPrivateKey,
  socketDir,
  activeTunnelStore,
  tunnelUrl,
  helloBaseResponse,
  tunnelsGauge,
  sshConnectionsGauge,
}: {
  log: Logger
  sshPrivateKey: string
  socketDir: string
  activeTunnelStore: ActiveTunnelStore
  tunnelUrl: (clientId: string, remotePath: string) => string
  helloBaseResponse: Record<string, unknown>
  tunnelsGauge: Pick<Gauge, 'inc' | 'dec'>
  sshConnectionsGauge: Pick<Gauge, 'inc' | 'dec'>
}) => {
  const onClient = (client: BaseSshClient) => {
    const { clientId, publicKey, envId, connectionId, publicKeyThumbprint, log } = client
    sshConnectionsGauge.inc({ envId })
    const cleanupClient = lodash.once(() => { sshConnectionsGauge.dec({ envId }) })
    const tunnels = new Map<string, string>()
    client
      .on('forward', async (requestId, { path: tunnelPath, access, meta, inject }, localSocketPath, accept, reject) => {
        const key = activeTunnelStoreKey(clientId, tunnelPath)

        log.info('creating tunnel %s for localSocket %s', key, localSocketPath)
        const set = async (): ReturnType<typeof activeTunnelStore['set']> => await activeTunnelStore.set(key, {
          tunnelPath,
          envId,
          target: localSocketPath,
          clientId,
          publicKey,
          access,
          hostname: key,
          publicKeyThumbprint,
          meta,
          inject,
          client,
        }).catch(async e => {
          if (!(e instanceof KeyAlreadyExistsError)) {
            throw e
          }
          const existingEntry = await activeTunnelStore.get(key)
          if (!existingEntry) {
            return await set() // retry
          }
          const otherClient = existingEntry.value.client as BaseSshClient
          if (otherClient.connectionId === connectionId) {
            throw new Error(`duplicate path: ${key}, from same connection ${connectionId}`)
          }
          if (!await otherClient.ping()) {
            const existingDelete = onceWithTimeout(existingEntry.watcher, 'delete', { milliseconds: 2000 })
            void otherClient.end()
            await existingDelete
            return await set() // retry
          }
          throw new Error(`duplicate path: ${key}, from different connection ${connectionId}`)
        })

        const setResult = await set().catch(err => { reject(err) })
        if (!setResult) {
          return
        }
        const { tx: setTx } = setResult
        const forward = await accept().catch(async e => {
          log.warn('error accepting forward %j: %j', requestId, inspect(e))
          await activeTunnelStore.delete(key, setTx)
        })
        if (!forward) {
          return
        }
        tunnels.set(requestId, tunnelUrl(clientId, tunnelPath))
        const cleanupTunnel = lodash.once(() => {
          tunnels.delete(requestId)
          void activeTunnelStore.delete(key, setTx)
          tunnelsGauge.dec({ clientId })
        })
        forward
          .on('close', () => {
            log.info('forward close: deleting tunnel %s', key)
            cleanupTunnel()
          })
          .on('error', err => {
            log.info('forward error: deleting tunnel %s due to forward server error: %j', key, inspect(err))
            cleanupTunnel()
          })
        tunnelsGauge.inc({ clientId })
      })
      .on('end', () => { cleanupClient() })
      .on('error', err => {
        log.warn('client error %j: %j', clientId, inspect(err))
        cleanupClient()
      })
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
  }

  return baseSshServer({
    log: serverLog,
    sshPrivateKey,
    socketDir,
  }).on('client', onClient)
}
