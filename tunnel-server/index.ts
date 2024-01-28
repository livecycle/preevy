import { promisify } from 'util'
import pino from 'pino'
import fs from 'fs'
import { KeyObject, createPublicKey } from 'crypto'
import { buildLoginUrl, app as createApp } from './src/app.js'
import { activeTunnelStoreKey, inMemoryActiveTunnelStore } from './src/tunnel-store/index.js'
import { getSSHKeys } from './src/ssh-keys.js'
import { proxy } from './src/proxy/index.js'
import { appLoggerFromEnv } from './src/logging.js'
import { tunnelsGauge, runMetricsServer, sshConnectionsGauge } from './src/metrics.js'
import { numberFromEnv, requiredEnv } from './src/env.js'
import { editUrl } from './src/url.js'
import { cookieSessionStore } from './src/session.js'
import { IdentityProvider, claimsSchema, cliIdentityProvider, jwtAuthenticator, saasIdentityProvider } from './src/auth.js'
import { createSshServer } from './src/ssh/index.js'

const log = pino.default(appLoggerFromEnv())

const { sshPrivateKey } = await getSSHKeys({
  defaultKeyLocation: './ssh/ssh_host_key',
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

log.info('base URL: %s', BASE_URL)

const isNotFoundError = (e: unknown) => (e as { code?: unknown })?.code === 'ENOENT'
const readFileSyncOrUndefined = (filename: string) => {
  try {
    return fs.readFileSync(filename, { encoding: 'utf8' })
  } catch (e) {
    if (isNotFoundError(e)) {
      return undefined
    }
    throw e
  }
}

const saasIdp = (() => {
  const saasPublicKeyStr = process.env.SAAS_PUBLIC_KEY || readFileSyncOrUndefined('/etc/certs/preview-proxy/saas.key.pub')
  if (!saasPublicKeyStr) {
    return undefined
  }
  const publicKey = createPublicKey(saasPublicKeyStr)
  const issuer = process.env.SAAS_JWT_ISSUER ?? 'app.livecycle.run'
  return saasIdentityProvider(issuer, publicKey)
})()

if (saasIdp) {
  log.info('SAAS auth will be enabled')
} else {
  log.info('No SAAS public key found, SAAS auth will be disabled')
}

const baseIdentityProviders: readonly IdentityProvider[] = Object.freeze(saasIdp ? [saasIdp] : [])

const authFactory = (
  { publicKey, publicKeyThumbprint }: { publicKey: KeyObject; publicKeyThumbprint: string },
) => jwtAuthenticator(
  publicKeyThumbprint,
  baseIdentityProviders.concat(cliIdentityProvider(publicKey, publicKeyThumbprint)),
)

const activeTunnelStore = inMemoryActiveTunnelStore({ log })
const sessionStore = cookieSessionStore({ domain: BASE_URL.hostname, schema: claimsSchema, keys: process.env.COOKIE_SECRETS?.split(' ') })

const app = createApp({
  sessionStore,
  activeTunnelStore,
  baseUrl: BASE_URL,
  proxy: proxy({
    activeTunnelStore,
    log,
    sessionStore,
    baseHostname: BASE_URL.hostname,
    authFactory,
    loginUrl: ({ env, returnPath }) => buildLoginUrl({ baseUrl: BASE_URL, env, returnPath }),
  }),
  log,
  authFactory,
  saasBaseUrl: saasIdp ? requiredEnv('SAAS_BASE_URL') : undefined,
})

const tunnelUrl = (
  rootUrl: URL,
  clientId: string,
  tunnel: string,
) => editUrl(rootUrl, { hostname: `${activeTunnelStoreKey(clientId, tunnel)}.${rootUrl.hostname}` }).toString()

const sshServer = createSshServer({
  log: log.child({ name: 'ssh_server' }),
  sshPrivateKey,
  socketDir: '/tmp', // TODO
  activeTunnelStore,
  helloBaseResponse: {
    // TODO: backwards compat, remove when we drop support for CLI v0.0.35
    baseUrl: { hostname: BASE_URL.hostname, port: BASE_URL.port, protocol: BASE_URL.protocol },
    rootUrl: BASE_URL.toString(),
  },
  tunnelsGauge,
  sshConnectionsGauge,
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
