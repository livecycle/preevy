import path from 'path'
import { ComposeClient } from './compose/client'
import { ComposeModel, ComposeService } from './compose/model'
import { SshClient } from './ssh/client'
import { TunnelOpts } from './ssh/url'
import { Tunnel } from './tunneling'

const DOCKER_PROXY_SERVICE_NAME = 'preview_proxy'
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

export const addDockerProxyService = (
  { tunnelOpts, sshPrivateKeyPath, knownServerPublicKeyPath, urlSuffix }: {
    tunnelOpts: TunnelOpts
    urlSuffix: string
    sshPrivateKeyPath: string
    knownServerPublicKeyPath: string
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
      },
    },
  },
})

export const queryTunnels = async (sshClient: SshClient, dockerProxyUrl: string) => {
  const { tunnels, clientId: tunnelId }: { tunnels: Tunnel[]; clientId: string } = JSON.parse((
    await sshClient.execCommand(`curl -sf http://${dockerProxyUrl}/tunnels`)
  ).stdout)

  return {
    tunnels: tunnels.filter((t: Tunnel) => t.service !== DOCKER_PROXY_SERVICE_NAME),
    tunnelId,
  }
}

export const findDockerProxyUrl = (
  compose: ComposeClient,
) => compose.getServiceUrl(DOCKER_PROXY_SERVICE_NAME, DOCKER_PROXY_PORT)
