import path from 'path'
import fetch from 'node-fetch'
import retry from 'p-retry'
import { mapValues } from 'lodash'
import { ComposeModel, ComposeService } from './compose/model'
import { TunnelOpts } from './ssh/url'
import { Tunnel } from './tunneling'
import { withBasicAuthCredentials } from './url'

export const COMPOSE_TUNNEL_AGENT_SERVICE_NAME = 'preevy_proxy'
export const COMPOSE_TUNNEL_AGENT_SERVICE_PORT = 3000
const COMPOSE_TUNNEL_AGENT_DIR = path.join(__dirname, '../../compose-tunnel-agent')

const baseDockerProxyService: ComposeService = {
  build: {
    context: COMPOSE_TUNNEL_AGENT_DIR,
  },
  labels: {
    'preevy.access': 'private',
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
      ...baseDockerProxyService,
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
