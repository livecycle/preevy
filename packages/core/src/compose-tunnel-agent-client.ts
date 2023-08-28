import path from 'path'
import fetch from 'node-fetch'
import retry from 'p-retry'
import util from 'util'
import { mapValues, merge } from 'lodash'
import { MachineStatusCommand, dateReplacer } from '@preevy/common'
import { ComposeModel, ComposeService, composeModelFilename } from './compose/model'
import { TunnelOpts } from './ssh/url'
import { Tunnel } from './tunneling'
import { withBasicAuthCredentials } from './credentials'
import { EnvMetadata, driverMetadataFilename } from './env-metadata'
import { REMOTE_DIR_BASE } from './remote-files'
import { isPacked, pkgSnapshotDir } from './pkg'
import { EnvId } from './env-id'

export const COMPOSE_TUNNEL_AGENT_SERVICE_NAME = 'preevy_proxy'
export const COMPOSE_TUNNEL_AGENT_PORT = 3000
const COMPOSE_TUNNEL_AGENT_DIR = path.join(path.dirname(require.resolve('@preevy/compose-tunnel-agent')), '..')

const baseDockerProxyService = () => {
  const contextDir = isPacked() ? pkgSnapshotDir(path.join(__dirname, '../../compose-tunnel-agent')) : COMPOSE_TUNNEL_AGENT_DIR
  return {
    build: {
      context: contextDir,
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
    user?: string
    envId: EnvId
    machineStatusCommand?: MachineStatusCommand
    envMetadata: EnvMetadata
    composeModelPath: string
  },
  model: ComposeModel,
): ComposeModel => ({
  ...model,
  services: {
    ...model.services,
    [COMPOSE_TUNNEL_AGENT_SERVICE_NAME]:
      merge(baseDockerProxyService(), {
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
        labels: {
          'preevy.env_id': envId,
        },
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
      }),
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
}: {
  composeTunnelServiceUrl: string
  credentials: { user: string; password: string }
  retryOpts?: retry.Options
  includeAccessCredentials: false | 'browser' | 'api'
}) => {
  const { tunnels } = await retry(async () => {
    const r = await fetch(
      `${composeTunnelServiceUrl}/tunnels`,
      { timeout: 2500, headers: { Authorization: `Bearer ${credentials.password}` } }
    )
    if (!r.ok) {
      throw new Error(`Failed to connect to docker proxy at ${composeTunnelServiceUrl}: ${r.status}: ${r.statusText}`)
    }
    return await (r.json() as Promise<{ tunnels: Tunnel[] }>)
  }, retryOpts)

  return tunnels
    .map(tunnel => ({
      ...tunnel,
      ports: mapValues(
        tunnel.ports,
        includeAccessCredentials
          ? withBasicAuthCredentials(credentials, includeAccessCredentials)
          : x => x,
      ),
    }))
}
