import path from 'path'
import fetch from 'node-fetch'
import retry from 'p-retry'
import { ComposeModel, ComposeService } from './compose/model'
import { SshClient } from './ssh/client'
import { TunnelOpts } from './ssh/url'
import { Tunnel } from './tunneling'

export const COMPOSE_TUNNEL_AGENT_SERVICE_NAME = 'preevy_proxy'
const COMPOSE_TUNNEL_AGENT_DIR = path.join(path.dirname(require.resolve('@preevy/compose-tunnel-agent')), '..')

const baseDockerProxyService: ComposeService = {
  build: {
    context: COMPOSE_TUNNEL_AGENT_DIR,
  },
}

export const minimalModelWithDockerProxyService = (name: string): ComposeModel => ({
  name,
  services: {
    [COMPOSE_TUNNEL_AGENT_SERVICE_NAME]: baseDockerProxyService,
  },
})

export const addBaseComposeTunnelAgentService = (
  model: ComposeModel,
): ComposeModel => ({
  ...model,
  services: {
    ...model.services,
    [COMPOSE_TUNNEL_AGENT_SERVICE_NAME]: baseDockerProxyService,
  },
})

const composeTunnelAgentSocket = (remoteProjectDir: string) => path.join(remoteProjectDir, 'compose-tunnel-agent.sock')

export const addComposeTunnelAgentService = (
  { tunnelOpts, sshPrivateKeyPath, knownServerPublicKeyPath, urlSuffix, debug, remoteBaseDir, user }: {
    tunnelOpts: TunnelOpts
    urlSuffix: string
    sshPrivateKeyPath: string
    knownServerPublicKeyPath: string
    debug: boolean
    remoteBaseDir: string
    user: string
  },
  model: ComposeModel,
): ComposeModel => {
  const socket = composeTunnelAgentSocket(remoteBaseDir)
  return ({
    ...model,
    services: {
      ...model.services,
      [COMPOSE_TUNNEL_AGENT_SERVICE_NAME]: {
        ...baseDockerProxyService,
        restart: 'always',
        networks: Object.keys(model.networks || {}),
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
          {
            type: 'bind',
            source: path.dirname(socket),
            target: '/preevy/socket',
          },
        ],
        user,
        environment: {
          SSH_URL: tunnelOpts.url,
          TLS_SERVERNAME: tunnelOpts.tlsServerName,
          TUNNEL_URL_SUFFIX: urlSuffix,
          PORT: path.join('/preevy/socket', path.basename(socket)),
          ...debug ? { DEBUG: '1' } : {},
          HOME: '/preevy',
        },
      },
    },
  })
}

export const queryTunnels = async ({ sshClient, remoteProjectDir, retryOpts = { retries: 0 } }: {
  sshClient: SshClient
  remoteProjectDir: string
  retryOpts?: retry.Options
}) => {
  const forwarding = await sshClient.forwardOutStreamLocal(
    { host: '0.0.0.0', port: 0 },
    composeTunnelAgentSocket(remoteProjectDir),
  )
  if (typeof forwarding.localSocket !== 'object') {
    throw new Error(`Invalid response from ssh forward: ${forwarding.localSocket}`)
  }

  const { address, port } = forwarding.localSocket
  const url = `http://${address}:${port}/tunnels`

  try {
    const { tunnels, clientId: tunnelId } = await retry(async () => {
      const r = await fetch(url, { timeout: 2500 })
      if (!r.ok) {
        throw new Error(`Failed to connect to docker proxy at ${url}: ${r.status}: ${r.statusText}`)
      }
      return r.json() as Promise<{ tunnels: Tunnel[]; clientId: string }>
    }, retryOpts)

    return {
      tunnels: tunnels.filter(({ service }: Tunnel) => service !== COMPOSE_TUNNEL_AGENT_SERVICE_NAME),
      tunnelId,
    }
  } finally {
    forwarding.close()
  }
}
