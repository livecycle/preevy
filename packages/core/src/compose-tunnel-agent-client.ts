import path from 'path'
import fetch from 'node-fetch'
import retry from 'p-retry'
import util from 'util'
import { mapValues } from 'lodash'
import { MachineStatusCommand, dateReplacer } from '@preevy/common'
import { ComposeModel, ComposeService, composeModelFilename } from './compose/model'
import { TunnelOpts } from './ssh/url'
import { Tunnel } from './tunneling'
import { withBasicAuthCredentials } from './url'
import { driverMetadataFilename } from './env-metadata'
import { REMOTE_DIR_BASE } from './remote-files'

export const COMPOSE_TUNNEL_AGENT_SERVICE_NAME = 'preevy_proxy'
export const COMPOSE_TUNNEL_AGENT_PORT = 3000
const COMPOSE_TUNNEL_AGENT_DIR = path.join(path.dirname(require.resolve('@preevy/compose-tunnel-agent')), '..')

const baseDockerProxyService: ComposeService = {
  build: {
    context: COMPOSE_TUNNEL_AGENT_DIR,
  },
  ports: [
    {
      mode: 'ingress',
      target: COMPOSE_TUNNEL_AGENT_PORT,
      published: '0',
      protocol: 'tcp',
    },
  ],
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

const metadataDirectory = '/preevy/metadata'

export const addComposeTunnelAgentService = (
  {
    tunnelOpts,
    sshPrivateKeyPath,
    knownServerPublicKeyPath,
    debug,
    user,
    envId,
    machineStatusCommand,
    envMetadata,
    composeModelPath,
  }: {
    tunnelOpts: TunnelOpts
    sshPrivateKeyPath: string
    knownServerPublicKeyPath: string
    debug: boolean
    user: string
    envId: string
    machineStatusCommand?: MachineStatusCommand
    envMetadata: Record<string, unknown>
    composeModelPath: string
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
          source: `${REMOTE_DIR_BASE}/${driverMetadataFilename}`,
          target: `${metadataDirectory}/${driverMetadataFilename}`,
          read_only: true,
          bind: { create_host_path: true },
        },
        {
          type: 'bind',
          source: composeModelPath,
          target: `/preevy/${composeModelFilename}`,
          read_only: true,
          bind: { create_host_path: true },
        },
      ],
      user,
      environment: {
        SSH_URL: tunnelOpts.url,
        TLS_SERVERNAME: tunnelOpts.tlsServerName,
        PREEVY_ENV_ID: envId,
        PORT: COMPOSE_TUNNEL_AGENT_PORT.toString(),
        ...machineStatusCommand ? { MACHINE_STATUS_COMMAND: JSON.stringify(machineStatusCommand) } : {},
        ENV_METADATA: JSON.stringify(envMetadata, dateReplacer),
        ENV_METADATA_FILES: `${metadataDirectory}/${driverMetadataFilename}`,
        ...debug ? { DEBUG: '1' } : {},
        HOME: '/preevy',
      },
    },
  },
})

export const findComposeTunnelAgentUrl = (
  serviceUrls: { name: string; port: number; url: string }[]
) => {
  const serviceUrl = serviceUrls.find(
    ({ name, port }) => name === COMPOSE_TUNNEL_AGENT_SERVICE_NAME && port === COMPOSE_TUNNEL_AGENT_PORT
  )?.url

  if (!serviceUrl) {
    throw new Error(`Cannot find compose tunnel agent API service URL ${COMPOSE_TUNNEL_AGENT_SERVICE_NAME}:${COMPOSE_TUNNEL_AGENT_PORT} in: ${util.inspect(serviceUrls)}`)
  }

  return serviceUrl
}

export const queryTunnels = async ({
  retryOpts = { retries: 0 },
  composeTunnelServiceUrl,
  credentials,
  includeAccessCredentials,
  showPreevyService,
}: {
  composeTunnelServiceUrl: string
  credentials: { user: string; password: string }
  retryOpts?: retry.Options
  includeAccessCredentials: boolean
  showPreevyService: boolean
}) => {
  const addCredentials = withBasicAuthCredentials(credentials)

  const { tunnels, clientId: tunnelId } = await retry(async () => {
    const r = await fetch(
      `${composeTunnelServiceUrl}/tunnels`,
      { timeout: 2500, headers: { Authorization: `Bearer ${credentials.password}` } }
    )
    if (!r.ok) {
      throw new Error(`Failed to connect to docker proxy at ${composeTunnelServiceUrl}: ${r.status}: ${r.statusText}`)
    }
    return await (r.json() as Promise<{ tunnels: Tunnel[]; clientId: string }>)
  }, retryOpts)

  return {
    tunnels: tunnels
      .filter(({ service }: Tunnel) => showPreevyService || service !== COMPOSE_TUNNEL_AGENT_SERVICE_NAME)
      .map(tunnel => ({
        ...tunnel,
        ports: mapValues(
          tunnel.ports,
          includeAccessCredentials
            ? (x: string) => `${addCredentials(x)}?_preevy_auth_hint=basic`
            : (x: string) => x
        ),
      })),
    tunnelId,
  }
}
