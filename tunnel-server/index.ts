import { inspect, promisify } from 'util'
import url from 'url'
import path from 'path'
import pino from 'pino'
import { createPublicKey } from 'crypto'
import { app as createApp } from './src/app'
import { inMemoryPreviewEnvStore } from './src/preview-env'
import { sshServer as createSshServer } from './src/ssh-server'
import { getSSHKeys } from './src/ssh-keys'
import { isProxyRequest, proxyHandlers } from './src/proxy'
import { appLoggerFromEnv } from './src/logging'
import { tunnelsGauge, runMetricsServer } from './src/metrics'
import { numberFromEnv, requiredEnv } from './src/env'
import { replaceHostname } from './src/url'

const __dirname = url.fileURLToPath(new URL('.', import.meta.url))

const logger = pino(appLoggerFromEnv())

const { sshPrivateKey } = await getSSHKeys({
  defaultKeyLocation: path.join(__dirname, './ssh/ssh_host_key'),
  log: logger,
})

const PORT = numberFromEnv('PORT') || 3000
const SSH_PORT = numberFromEnv('SSH_PORT') || 2222
const LISTEN_HOST = '0.0.0.0'
const BASE_URL = (() => {
  const result = new URL(requiredEnv('BASE_URL'))
  if (result.pathname !== '/' || result.search || result.username || result.password || result.hash) {
    throw new Error(`Invalid URL: ${result} - cannot specify path, search, username, password, or hash`)
  }
  return result
})()

const envStore = inMemoryPreviewEnvStore()

const app = createApp({
  isProxyRequest: isProxyRequest(BASE_URL.hostname),
  proxyHandlers: proxyHandlers({ envStore, logger }),
  logger,
})
const sshLog = logger.child({ name: 'ssh_server' })

const tunnelName = (hostnameSuffix: string, remotePath: string) => {
  const serviceName = remotePath.replace(/^\//, '')
  return `${serviceName}-${hostnameSuffix}`.toLowerCase()
}

const tunnelUrl = (
  rootUrl: URL,
  clientId: string,
  tunnel: string,
) => replaceHostname(rootUrl, `${tunnelName(clientId, tunnel)}.${rootUrl.hostname}`).toString()

const tunnelsPerClientUniqueId = new Map<string, Map<string, { closeForward:() => void }>>()

const sshServer = createSshServer({
  log: sshLog,
  sshPrivateKey,
  socketDir: '/tmp', // TODO
})
  .on('client', client => {
    const { hostnameSuffix, publicKey, uniqueId } = client
    const clientLog = sshLog.child({ uniqueClientId: uniqueId })
    const tunnels = new Map<string, { tunnelUrl: string; closeForward:() => void }>()
    tunnelsPerClientUniqueId.set(uniqueId, tunnels)
    client
      .on('forward', async (requestId, { path: remotePath, access }, accept, reject) => {
        const forwardLog = clientLog.child({ forwardId: requestId })
        const key = tunnelName(hostnameSuffix, remotePath)
        const existingEntry = await envStore.get(key)
        if (existingEntry) {
          if (existingEntry.clientUniqueId === uniqueId) {
            reject(new Error(`duplicate request ${requestId} for client ${uniqueId} suffix ${hostnameSuffix}`))
            return
          }
          forwardLog.warn('forward: overriding duplicate envStore entry for path %s: %j', key, existingEntry)
          await envStore.delete(key, existingEntry.clientUniqueId)

          // close tunnel of overridden client
          tunnelsPerClientUniqueId.get(existingEntry.clientUniqueId)?.get(requestId)?.closeForward()
        }
        const forward = await accept()
        forwardLog.debug('creating tunnel %s for localSocket %s', key, forward.localSocketPath)
        await envStore.set(key, {
          clientUniqueId: uniqueId,
          hostnameSuffix,
          target: forward.localSocketPath,
          publicKey: createPublicKey(publicKey.getPublicPEM()),
          access,
        })
        tunnels.set(requestId, {
          tunnelUrl: tunnelUrl(BASE_URL, hostnameSuffix, remotePath),
          closeForward: () => {
            forwardLog.debug('calling forward.close')
            forward.close()
          },
        })
        tunnelsGauge.inc({ clientId: hostnameSuffix })

        forward.on('close', async () => {
          forwardLog.debug('forward close event')
          tunnels.delete(requestId)
          const storedEnv = await envStore.delete(key, uniqueId)
          if (!storedEnv) {
            forwardLog.info('forward.close: no stored env')
            return
          }
          tunnelsGauge.dec({ clientId: hostnameSuffix })
        })
      })
      .on('close', () => {
        clientLog.debug('client %s closed', uniqueId)
        tunnels.forEach(t => t.closeForward())
        tunnelsPerClientUniqueId.delete(uniqueId)
      })
      .on('error', err => { clientLog.warn('client error %j', inspect(err)) })
      .on('hello', channel => {
        channel.stdout.write(`${JSON.stringify({
          clientId: hostnameSuffix,
          // TODO: backwards compat, remove when we drop support for CLI v0.0.35
          baseUrl: { hostname: BASE_URL.hostname, port: BASE_URL.port, protocol: BASE_URL.protocol },
          rootUrl: BASE_URL.toString(),
          tunnels: Object.fromEntries(tunnels.entries()),
        })}\r\n`)
        channel.exit(0)
      })
  })
  .listen(SSH_PORT, LISTEN_HOST, () => {
    app.log.debug('ssh server listening on port %j', SSH_PORT)
  })
  .on('error', (err: unknown) => {
    app.log.error('ssh server error: %j', err)
  })

app.listen({ host: LISTEN_HOST, port: PORT }).catch(err => {
  app.log.error(err)
  process.exit(1)
})

runMetricsServer(8888).catch(err => {
  app.log.error(err)
});

['SIGTERM', 'SIGINT'].forEach(signal => {
  process.once(signal, () => {
    app.log.info(`shutting down on ${signal}`)
    Promise.all([promisify(sshServer.close).call(sshServer), app.close()])
      .catch(err => {
        app.log.error(err)
        process.exit(1)
      })
      .finally(() => {
        process.exit(0)
      })
  })
})
