import path from 'path'
import fs from 'fs'
import url from 'url'
import { promisify } from 'util'
import { app as createApp } from './src/app'
import { numberFromEnv } from './src/env'
import { inMemoryPreviewEnvStore } from './src/preview-env'
import { sshServer as createSshServer } from './src/ssh-server'

const PORT = numberFromEnv('PORT') || 3000
const SSH_PORT = numberFromEnv('SSH_PORT') || 2222
const LISTEN_HOST = '0.0.0.0'

const __dirname = url.fileURLToPath(new URL('.', import.meta.url))

const HOST_KEY_FILENAME = path.join(__dirname, 'ssh', 'ssh_host_key')
const [sshPrivateKey, sshPublicKey] = await Promise.all([HOST_KEY_FILENAME, `${HOST_KEY_FILENAME}.pub`]
  .map(f => fs.promises.readFile(f, 'utf8'))
)
  
const envStore = inMemoryPreviewEnvStore({
  test: {
    target: 'http://3.73.126.120',
  },
})

const app = createApp({ envStore, sshPublicKey })
const sshLogger = app.log.child({ component: 'ssh_server' })

const tunnelName = (clientId: string, remotePath: string) => {
  const serviceName = remotePath.replace(/^\//, '')
  return `${serviceName}-${clientId}`
}

const sshServer = createSshServer({
  log: sshLogger,
  sshPrivateKey,
  socketDir: '/tmp', // TODO
  onPipeCreated: async (clientId, remotePath, localSocket) => {
    const key = tunnelName(clientId, remotePath);
    sshLogger.debug('creating tunnel %s for localSocket %s', key, localSocket)
    await envStore.set(key, { target: localSocket })
  },
  onPipeDestroyed: async (clientId, remotePath) => {
    await envStore.delete(tunnelName(clientId, remotePath))
  },
  onHello: clientId => JSON.stringify({ clientId }) + '\r\n',
})
  .listen(SSH_PORT, LISTEN_HOST, () => {
    app.log.debug('ssh server listening on port %j', SSH_PORT)
  })
  .on('error', (err: unknown) => {
    app.log.error('ssh server error: %j', err)
  })

app.listen({ host: LISTEN_HOST, port: PORT }).catch((err) => {
  app.log.error(err)
  process.exit(1)
})

;['SIGTERM', 'SIGINT'].forEach((signal) => {
  process.once(signal, () => {
    app.log.info(`shutting down on ${signal}`)
    Promise.all([promisify(sshServer.close).call(sshServer), app.close()])
      .catch((err) => {
        app.log.error(err)
        process.exit(1)
      })
      .finally(() => {
        process.exit(0)
      })
  })
})
