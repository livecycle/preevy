import { promisify } from 'util'
import url from 'url'
import path from 'path'
import pino from 'pino'
import fs from 'fs'
import { createPublicKey } from 'crypto'
import { app as createApp } from './src/app'
import { inMemoryActiveTunnelStore } from './src/tunnel-store'
import { getSSHKeys } from './src/ssh-keys'
import { proxy } from './src/proxy'
import { appLoggerFromEnv } from './src/logging'
import { tunnelsGauge, runMetricsServer } from './src/metrics'
import { numberFromEnv, requiredEnv } from './src/env'
import { editUrl } from './src/url'
import { cookieSessionStore } from './src/session'
import { claimsSchema } from './src/auth'
import { createSshServer } from './src/ssh'
import { truncateWithHash } from './src/strings'

const __dirname = url.fileURLToPath(new URL('.', import.meta.url))

const log = pino(appLoggerFromEnv())

const { sshPrivateKey } = await getSSHKeys({
  defaultKeyLocation: path.join(__dirname, './ssh/ssh_host_key'),
  log,
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

const SAAS_PUBLIC_KEY = process.env.SAAS_PUBLIC_KEY || fs.readFileSync(
  path.join('/', 'etc', 'certs', 'preview-proxy', 'saas.key.pub'),
  { encoding: 'utf8' },
)

const publicKey = createPublicKey(SAAS_PUBLIC_KEY)
const SAAS_JWT_ISSUER = process.env.SAAS_JWT_ISSUER ?? 'app.livecycle.run'

const activeTunnelStore = inMemoryActiveTunnelStore({ log })
const appSessionStore = cookieSessionStore({ domain: BASE_URL.hostname, schema: claimsSchema, keys: process.env.COOKIE_SECRETS?.split(' ') })
const loginUrl = new URL('/login', editUrl(BASE_URL, { hostname: `auth.${BASE_URL.hostname}` })).toString()
const app = createApp({
  sessionStore: appSessionStore,
  activeTunnelStore,
  baseUrl: BASE_URL,
  proxy: proxy({
    activeTunnelStore,
    log,
    loginUrl,
    sessionStore: appSessionStore,
    publicKey,
    jwtSaasIssuer: SAAS_JWT_ISSUER,
    baseHostname: BASE_URL.hostname,
  }),
  log,
  loginUrl,
  jwtSaasIssuer: SAAS_JWT_ISSUER,
  saasPublicKey: publicKey,
})
const sshLogger = log.child({ name: 'ssh_server' })

const MAX_DNS_LABEL_LENGTH = 63

const activeTunnelStoreKey = (clientId: string, remotePath: string) => {
  const noLeadingSlash = remotePath.replace(/^\//, '')
  // return value needs to be DNS safe:
  // - max DNS label name length is 63 octets (== 63 ASCII chars)
  // - case insensitive
  return truncateWithHash(
    `${noLeadingSlash}-${clientId}`.replace(/[^a-zA-Z0-9_-]/g, '-'),
    MAX_DNS_LABEL_LENGTH,
  ).toLowerCase()
}

const tunnelUrl = (
  rootUrl: URL,
  clientId: string,
  tunnel: string,
) => editUrl(rootUrl, { hostname: `${activeTunnelStoreKey(clientId, tunnel)}.${rootUrl.hostname}` }).toString()

const sshServer = createSshServer({
  log: sshLogger,
  sshPrivateKey,
  socketDir: '/tmp', // TODO
  activeTunnelStore,
  activeTunnelStoreKey,
  helloBaseResponse: {
    // TODO: backwards compat, remove when we drop support for CLI v0.0.35
    baseUrl: { hostname: BASE_URL.hostname, port: BASE_URL.port, protocol: BASE_URL.protocol },
    rootUrl: BASE_URL.toString(),
  },
  tunnelsGauge,
  tunnelUrl: (clientId, remotePath) => tunnelUrl(BASE_URL, clientId, remotePath),
})
  .listen(SSH_PORT, LISTEN_HOST, () => {
    app.log.debug('ssh server listening on port %j', SSH_PORT)
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
