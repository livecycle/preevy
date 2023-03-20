import path from 'path'
import { ComposeClient } from './compose/client'
import { ComposeModel, ComposeService } from './compose/model'
import { SshClient } from './ssh/client'
import { TunnelOpts } from './ssh/url'
import { Tunnel } from './tunneling'

export const DOCKER_PROXY_SERVICE_NAME = 'preview_proxy'
const DOCKER_PROXY_DIR = path.join(path.dirname(require.resolve('@livecycle/docker-proxy')), '..')
const DOCKER_PROXY_PORT = 3000

const baseDockerProxyService: ComposeService = {
  build: {
    context: DOCKER_PROXY_DIR,
  },
  ports: [
    { mode: 'ingress', target: DOCKER_PROXY_PORT, protocol: 'tcp' },
  ],
}

export const minimalModelWithDockerProxyService = (name: string): ComposeModel => ({
  name,
  services: {
    [DOCKER_PROXY_SERVICE_NAME]: baseDockerProxyService,
  },
})

export const addBaseDockerProxyService = (
  model: ComposeModel,
): ComposeModel => ({
  ...model,
  services: {
    ...model.services,
    [DOCKER_PROXY_SERVICE_NAME]: baseDockerProxyService,
  },
})

export const addDockerProxyService = (
  { tunnelOpts, sshPrivateKeyPath, knownServerPublicKeyPath, urlSuffix, debug }: {
    tunnelOpts: TunnelOpts
    urlSuffix: string
    sshPrivateKeyPath: string
    knownServerPublicKeyPath: string
    debug: boolean
  },
  model: ComposeModel,
): ComposeModel => ({
  ...model,
  services: {
    ...model.services,
    [DOCKER_PROXY_SERVICE_NAME]: {
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
          target: '/root/.ssh/id_rsa',
          read_only: true,
          bind: { create_host_path: true },
        },
        {
          type: 'bind',
          source: knownServerPublicKeyPath,
          target: '/root/.ssh/known_server_keys/tunnel_server',
          read_only: true,
          bind: { create_host_path: true },
        },
      ],
      environment: {
        SSH_URL: tunnelOpts.url,
        TLS_SERVERNAME: tunnelOpts.tlsServerName,
        TUNNEL_URL_SUFFIX: urlSuffix,
        ...debug ? { DEBUG: '1' } : {},
      },
    },
  },
})

export const queryTunnels = async (
  sshClient: SshClient,
  dockerProxyUrl: string,
  waitForServices: string[],
  filterServices?: string[],
) => {
  const command = `curl -sf http://${dockerProxyUrl}/tunnels?waitFor=${waitForServices.map(encodeURIComponent).join(',')}`;

  const { tunnels, clientId: tunnelId }: { tunnels: Tunnel[]; clientId: string } = JSON.parse((
    await sshClient.execCommand(command)
  ).stdout)

  return {
    tunnels: tunnels
      .filter(({ service }: Tunnel) => service !== DOCKER_PROXY_SERVICE_NAME)
      .filter(({ service }: Tunnel) => !filterServices?.length || filterServices.includes(service)),
    tunnelId,
  }
}

export const findDockerProxyUrl = (
  compose: ComposeClient,
) => compose.getServiceUrl(DOCKER_PROXY_SERVICE_NAME, DOCKER_PROXY_PORT)
