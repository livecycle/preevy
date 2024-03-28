import { promisify } from 'util'
import pino, { Level } from 'pino'
import { KeyObject, createPublicKey } from 'crypto'
import { ListenOptions } from 'net'
import { createApp } from './src/app/index.js'
import { activeTunnelStoreKey, inMemoryActiveTunnelStore } from './src/tunnel-store/index.js'
import { getSSHKeys } from './src/ssh-keys.js'
import { proxy } from './src/proxy/index.js'
import { appLoggerFromEnv } from './src/logging.js'
import { tunnelsGauge, metricsServer as createMetricsServer, sshConnectionsGauge } from './src/metrics.js'
import { numberFromEnv, requiredEnv } from './src/env.js'
import { editUrl } from './src/url.js'
import { cookieSessionStore } from './src/session.js'
import { IdentityProvider, claimsSchema, cliIdentityProvider, jwtAuthenticator, saasIdentityProvider } from './src/auth.js'
import { createSshServer } from './src/ssh/index.js'
import { calcLoginUrl } from './src/app/urls.js'
import { createTlsServer } from './src/tls-server.js'
import { readFileSyncOrUndefined } from './src/files.js'

type HasListen = {
  listen: (opts: ListenOptions, callback: (err?: unknown) => void) => void
}

const LISTEN_HOST = '0.0.0.0'
const listen = async <T extends HasListen>({ log, server, port }: {
  server: T
  log: pino.Logger<Level>
  port: number
}) => {
  try {
    await promisify(server.listen).call(server, { port, host: LISTEN_HOST })
    log.info('Listening on port %d', port)
  } catch (e) {
    log.error(new Error(`Error listening on port ${port}`, { cause: e }))
    process.exit(1)
  }
  return server
}

const log = pino.default<Level>(appLoggerFromEnv())

const { sshPrivateKey } = await getSSHKeys({
  defaultKeyLocation: './ssh/ssh_host_key',
  log,
})

const PORT = numberFromEnv('PORT') || 3000
const SSH_PORT = numberFromEnv('SSH_PORT') || 2222
const BASE_URL = (() => {
  const result = new URL(requiredEnv('BASE_URL'))
  if (result.pathname !== '/' || result.search || result.username || result.password || result.hash) {
    throw new Error(`Invalid URL: ${result} - cannot specify path, search, username, password, or hash`)
  }
  return result
})()

log.info('base URL: %s', BASE_URL)

const tlsConfig = (() => {
  const cert = process.env.TLS_CERT || readFileSyncOrUndefined(process.env.TLS_CERT_FILE || './tls/cert.pem')
  const key = process.env.TLS_KEY || readFileSyncOrUndefined(process.env.TLS_KEY_FILE || './tls/key.pem')
  if (!cert || !key) {
    log.warn('No TLS cert or key found, TLS will be disabled')
    return undefined
  }
  log.info('TLS will be enabled')
  return { cert, key }
})()

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

const activeTunnelStore = inMemoryActiveTunnelStore({ log: log.child<Level>({ name: 'tunnel_store' }) })
const sessionStore = cookieSessionStore({ domain: BASE_URL.hostname, schema: claimsSchema, keys: process.env.COOKIE_SECRETS?.split(' ') })

const appLog = log.child<Level>({ name: 'app' })
const app = await listen({
  server: await createApp({
    sessionStore,
    activeTunnelStore,
    baseUrl: BASE_URL,
    proxy: proxy({
      activeTunnelStore,
      log,
      sessionStore,
      baseHostname: BASE_URL.hostname,
      authFactory,
      loginUrl: ({ env, returnPath }) => calcLoginUrl({ baseUrl: BASE_URL, env, returnPath }),
    }),
    log: appLog,
    authFactory,
    saasBaseUrl: saasIdp ? new URL(requiredEnv('SAAS_BASE_URL')) : undefined,
  }),
  log: appLog,
  port: PORT,
})

const tunnelUrl = (
  rootUrl: URL,
  clientId: string,
  tunnel: string,
) => editUrl(rootUrl, { hostname: `${activeTunnelStoreKey(clientId, tunnel)}.${rootUrl.hostname}` }).toString()

const sshServerLog = log.child<Level>({ name: 'ssh_server' })
const sshServer = await listen({
  server: createSshServer({
    log: sshServerLog,
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
  }),
  log: sshServerLog,
  port: SSH_PORT,
})

const TLS_PORT = numberFromEnv('TLS_PORT') ?? 8443
const tlsLog = log.child({ name: 'tls_server' })
const tlsServer = tlsConfig
  ? await listen({
    server: createTlsServer({
      log: tlsLog,
      tlsConfig,
      sshServer,
      httpServer:
      app.server,
      sshHostnames: process.env.SSH_HOSTNAMES ? process.env.SSH_HOSTNAMES.split(',') : [BASE_URL.hostname],
    }),
    port: TLS_PORT,
    log: tlsLog,
  }) : undefined

const metricsLerverLog = log.child({ name: 'metrics_server' })
const metricsServer = await listen({
  server: createMetricsServer({ log: metricsLerverLog }),
  port: 8888,
  log: metricsLerverLog,
})

const exitSignals = ['SIGTERM', 'SIGINT'] as const
const servers = [app, sshServer, metricsServer, ...tlsServer ? [tlsServer] : []] as const

exitSignals.forEach(signal => {
  process.once(signal, async () => {
    log.info(`Shutting down on ${signal}`)
    await Promise.all(servers.map(server => promisify(server.close).call(server))).catch(err => {
      log.error(err)
      process.exit(1)
    })
    process.exit(0)
  })
})
