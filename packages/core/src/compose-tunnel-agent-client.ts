import path from 'path'
import fetch from 'node-fetch'
import retry from 'p-retry'
import { mapValues, memoize } from 'lodash'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, statSync } from 'fs'
import { tmpdir } from 'os'
import { ComposeModel, ComposeService } from './compose/model'
import { TunnelOpts } from './ssh/url'
import { Tunnel } from './tunneling'
import { withBasicAuthCredentials } from './url'

export const COMPOSE_TUNNEL_AGENT_SERVICE_NAME = 'preevy_proxy'
export const COMPOSE_TUNNEL_AGENT_SERVICE_PORT = 3000
const COMPOSE_TUNNEL_AGENT_DIR = path.join(path.dirname(require.resolve('@preevy/compose-tunnel-agent')), '..')
declare let process : {
  pkg?: {}
}

const pkgComposeTunnelAgentDirFromSnapshot = memoize(() => {
  // can't use fs.cpSync because it's not patched by pkg (https://github.com/vercel/pkg/blob/bb042694e4289a1cbc530d2938babe35ccc84a93/prelude/bootstrap.js#L600)
  const copyDirRecursive = (sourceDir: string, targetDir:string) => {
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir)
    }
    const files = readdirSync(sourceDir)
    for (const file of files) {
      const sourcePath = path.join(sourceDir, file)
      const targetPath = path.join(targetDir, file)
      const stat = statSync(sourcePath)
      if (stat.isDirectory()) {
        copyDirRecursive(sourcePath, targetPath)
      } else {
        copyFileSync(sourcePath, targetPath)
      }
    }
  }
  const dest = mkdtempSync(path.join(tmpdir(), 'compose-tunnel-agent'))
  copyDirRecursive(path.join(__dirname, '../../compose-tunnel-agent'), dest)
  return dest
})

const baseDockerProxyService = () => {
  const contextDir = process?.pkg ? pkgComposeTunnelAgentDirFromSnapshot() : COMPOSE_TUNNEL_AGENT_DIR
  return {
    build: {
      context: contextDir,
    },
    labels: {
      'preevy.access': 'private',
    },
  } as ComposeService
}

export const addBaseComposeTunnelAgentService = (
  model: ComposeModel,
): ComposeModel => ({
  ...model,
  services: {
    ...model.services,
    [COMPOSE_TUNNEL_AGENT_SERVICE_NAME]: baseDockerProxyService(),
  },
})

export const addComposeTunnelAgentService = (
  { tunnelOpts, sshPrivateKeyPath, knownServerPublicKeyPath, urlSuffix, debug, user }: {
    tunnelOpts: TunnelOpts
    urlSuffix: string
    sshPrivateKeyPath: string
    knownServerPublicKeyPath: string
    debug: boolean
    user: string
  },
  model: ComposeModel,
): ComposeModel => ({
  ...model,
  services: {
    ...model.services,
    [COMPOSE_TUNNEL_AGENT_SERVICE_NAME]: {
      ...baseDockerProxyService(),
      restart: 'always',
      networks: Object.keys(model.networks || {}),
      ports: [
        {
          mode: 'ingress',
          target: 3000,
          published: '0',
          protocol: 'tcp',
        },
      ],
      volumes: [
        {
          type: 'bind',
          source: '/var/run/docker.sock',
          target: '/var/run/docker.sock',
        },
        {
          type: 'bind',
          source: sshPrivateKeyPath,
          target: '/preevy/.ssh/id_rsa',
          read_only: true,
          bind: { create_host_path: true },
        },
        {
          type: 'bind',
          source: knownServerPublicKeyPath,
          target: '/preevy/known_server_keys/tunnel_server',
          read_only: true,
          bind: { create_host_path: true },
        },
      ],
      user,
      environment: {
        SSH_URL: tunnelOpts.url,
        TLS_SERVERNAME: tunnelOpts.tlsServerName,
        TUNNEL_URL_SUFFIX: urlSuffix,
        PORT: COMPOSE_TUNNEL_AGENT_SERVICE_PORT.toString(),
        ...debug ? { DEBUG: '1' } : {},
        HOME: '/preevy',
      },
    },
  },
})

export const queryTunnels = async ({
  retryOpts = { retries: 0 },
  tunnelUrlsForService,
  credentials,
  includeAccessCredentials,
}: {
  tunnelUrlsForService: (service: { name: string; ports: number[] }) => { port: number; url: string }[]
  credentials: { user: string; password: string }
  retryOpts?: retry.Options
  includeAccessCredentials: boolean
}) => {
  const serviceUrl = tunnelUrlsForService({
    name: COMPOSE_TUNNEL_AGENT_SERVICE_NAME,
    ports: [COMPOSE_TUNNEL_AGENT_SERVICE_PORT],
  })[0].url.replace(/\/$/, '')

  const addCredentials = withBasicAuthCredentials(credentials)
  const url = addCredentials(`${serviceUrl}/tunnels`)

  const { tunnels, clientId: tunnelId } = await retry(async () => {
    const r = await fetch(url, { timeout: 2500 })
    if (!r.ok) {
      throw new Error(`Failed to connect to docker proxy at ${url}: ${r.status}: ${r.statusText}`)
    }
    return await (r.json() as Promise<{ tunnels: Tunnel[]; clientId: string }>)
  }, retryOpts)

  return {
    tunnels: tunnels
      .filter(({ service }: Tunnel) => service !== COMPOSE_TUNNEL_AGENT_SERVICE_NAME)
      .map(tunnel => ({
        ...tunnel,
        ports: mapValues(tunnel.ports, includeAccessCredentials ? addCredentials : (x: string) => x),
      })),
    tunnelId,
  }
}
