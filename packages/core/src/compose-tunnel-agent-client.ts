import { COMPOSE_TUNNEL_AGENT_PORT, COMPOSE_TUNNEL_AGENT_SERVICE_LABELS, COMPOSE_TUNNEL_AGENT_SERVICE_NAME, MachineStatusCommand, ScriptInjection, dateReplacer } from '@preevy/common'
import { mapValues, merge } from 'lodash-es'
import { createRequire } from 'module'
import retry from 'p-retry'
import path from 'path'
import util from 'util'
import { ComposeModel, ComposeService, composeModelFilename } from './compose/model.js'
import { addScriptInjectionsToServices } from './compose/script-injection.js'
import { withBasicAuthCredentials } from './credentials/index.js'
import { EnvId } from './env-id.js'
import { EnvMetadata, driverMetadataFilename } from './env-metadata.js'
import { REMOTE_DIR_BASE } from './remote-files.js'
import { TunnelOpts } from './ssh/url.js'
import { Tunnel } from './tunneling/index.js'

const require = createRequire(import.meta.url)
const COMPOSE_TUNNEL_AGENT_DIR = path.join(path.dirname(require.resolve('@preevy/compose-tunnel-agent')), '..')

const baseDockerProxyService = () => ({
  build: {
    context: COMPOSE_TUNNEL_AGENT_DIR,
    dockerfile: path.join(COMPOSE_TUNNEL_AGENT_DIR, 'Dockerfile'),
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
    [COMPOSE_TUNNEL_AGENT_SERVICE_LABELS.ACCESS]: 'private',
  },
} as ComposeService)

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
    envId,
    machineStatusCommand,
    envMetadata,
    composeModelPath,
    composeProject,
    profileThumbprint,
    privateMode,
    defaultAccess,
    scriptInjections,
  }: {
    tunnelOpts: TunnelOpts
    sshPrivateKeyPath: string
    knownServerPublicKeyPath: string
    debug: boolean
    envId: EnvId
    machineStatusCommand?: MachineStatusCommand
    envMetadata: EnvMetadata
    composeModelPath: string
    composeProject: string
    profileThumbprint?: string
    privateMode: boolean
    defaultAccess: 'private' | 'public'
    scriptInjections?: (serviceName: string, serviceDef: ComposeService) => Record<string, ScriptInjection> | undefined
  },
  model: ComposeModel,
): ComposeModel => ({
  ...model,
  services: {
    ...scriptInjections ? addScriptInjectionsToServices(model.services, scriptInjections) : model.services,
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
        labels: {
          [COMPOSE_TUNNEL_AGENT_SERVICE_LABELS.ENV_ID]: envId,
          ...profileThumbprint ? { [COMPOSE_TUNNEL_AGENT_SERVICE_LABELS.PROFILE_THUMBPRINT]: profileThumbprint } : {},
          [COMPOSE_TUNNEL_AGENT_SERVICE_LABELS.PRIVATE_MODE]: privateMode.toString(),
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
          COMPOSE_PROJECT: composeProject,
          DEFAULT_ACCESS_LEVEL: defaultAccess,
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

const ensureExpectedServices = (
  { tunnels }: { tunnels: Tunnel[] }, 
  expectedServiceNames: string[]
) => {
  const actualServiceNames = new Set(tunnels.map(tunnel => tunnel.service))
  const missingServiceNames = expectedServiceNames.filter(name => !actualServiceNames.has(name))
  if (missingServiceNames.length) {
    throw new Error(`Expected service names ${missingServiceNames.join(', ')} not found in tunnels: ${util.inspect(tunnels)}`)
  }
}

export const queryTunnels = async ({
  retryOpts = { retries: 0 },
  composeTunnelServiceUrl,
  credentials,
  includeAccessCredentials,
  fetchTimeout,
  expectedServiceNames,
}: {
  composeTunnelServiceUrl: string
  credentials: { user: string; password: string }
  retryOpts?: retry.Options
  includeAccessCredentials: false | 'browser' | 'api'
  fetchTimeout: number
  expectedServiceNames?: string[]  
}) => {
  const { tunnels } = await retry(async () => {
    const r = await fetch(
      `${composeTunnelServiceUrl}/tunnels`,
      { signal: AbortSignal.timeout(fetchTimeout), headers: { Authorization: `Bearer ${credentials.password}` } }
    ).catch(e => { throw new Error(`Failed to connect to docker proxy at ${composeTunnelServiceUrl}: ${e}`, { cause: e }) })
    if (!r.ok) {
      throw new Error(`Failed to connect to docker proxy at ${composeTunnelServiceUrl}: ${r.status}: ${r.statusText}`)
    }
    const tunnelsObj = await (r.json() as Promise<{ tunnels: Tunnel[] }>)
    if (expectedServiceNames) {
      ensureExpectedServices(tunnelsObj, expectedServiceNames)
    }
    return tunnelsObj
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
