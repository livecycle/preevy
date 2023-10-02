import { COMPOSE_TUNNEL_AGENT_PORT, COMPOSE_TUNNEL_AGENT_SERVICE_NAME, tunnelNameResolver } from '@preevy/common'
import { mkdtemp, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { tmpdir } from 'node:os'
import { set } from 'lodash'
import { Connection } from '../tunneling'
import { execPromiseStdout } from '../child-process'
import { addComposeTunnelAgentService } from '../compose-tunnel-agent-client'
import { ComposeModel } from '../compose'
import { TunnelOpts } from '../ssh'
import { EnvId } from '../env-id'
import { EnvMetadata, detectGitMetadata } from '../env-metadata'

export const agentServiceName = COMPOSE_TUNNEL_AGENT_SERVICE_NAME

export async function getPreevyAgentUrl(client: Connection['client'], envId: string) {
  const tunnelNames = tunnelNameResolver({ envId })({ name: agentServiceName, ports: [COMPOSE_TUNNEL_AGENT_PORT] })
    .map(({ tunnel }) => tunnel)
  const tunnels = await client.execTunnelUrl(tunnelNames)
  return Object.values(tunnels)[0]
}

export function inspectRunningComposeApp(projectName: string) {
  const projectFilter = `label=com.docker.compose.project=${projectName}`
  const dockerCmd = async (cmd:string) => await execPromiseStdout(`docker ${cmd}`)
  const getComposeNetworks = async () => {
    const composeNetworks = await dockerCmd(`network ls --filter ${projectFilter} --filter label=com.docker.compose.network --format=json`)
      .then(x => x.split('\n').filter(n => n).map(n => JSON.parse(n) as {
        Name: string
        Labels: string
        }))
    const getNetworkName = (labels: string) => labels.split(',').map(l => l.split('=')).find(l => l[0] === 'com.docker.compose.network')?.[1]
    return Object.fromEntries(composeNetworks.map(x => ([getNetworkName(x.Labels), { name: x.Name }])))
  }

  function parseJSONContainer(s: string) {
    const ctr = JSON.parse(s) as {Names: string; ID: string; Labels: string }
    return { names: ctr.Names, id: ctr.ID, labels: Object.fromEntries(ctr.Labels.split(',').map(l => l.split('='))) as Record<string, string> }
  }

  const getPreevyAgentContainer = async () => {
    const agentContainer = await dockerCmd(`ps --filter ${projectFilter} --filter label=com.docker.compose.service=${agentServiceName} --format json`)
    if (!agentContainer) {
      return null
    }
    return parseJSONContainer(agentContainer)
  }

  const getEnvId = async () => {
    const agentContainer = await getPreevyAgentContainer()
    return agentContainer?.labels['preevy.env_id']
  }

  const listAllContainers = async () => ((await dockerCmd(`ps -a --filter ${projectFilter} --format json`)).split('\n') ?? [])
    .map(parseJSONContainer)

  const getWorkingDirectory = async () => {
    const containers = await listAllContainers()
    return containers.find(x => x.labels['com.docker.compose.service'] !== agentServiceName)?.labels['com.docker.compose.project.working_dir']
  }
  return {
    getComposeNetworks,
    getPreevyAgentContainer,
    getEnvId,
    getWorkingDirectory,
    listAllContainers,
  }
}

export async function initProxyComposeModel(opts: {
  envId: EnvId
  projectName: string
  tunnelOpts: TunnelOpts
  tunnelingKeyThumbprint: string
  debug?: boolean
  privateMode?: boolean
  serviceNames: string[]
  networks: ComposeModel['networks']
  version: string
  injectLivecycleScript?: string
  projectDirectory?: string
}) {
  const compose: ComposeModel = {
    version: '3.8',
    name: opts.projectName,
    networks: opts.networks,
  }

  const privateMode = Boolean(opts.privateMode)
  const envMetadata:EnvMetadata = {
    id: opts.envId,
    lastDeployTime: new Date(),
    version: opts.version,
    profileThumbprint: opts.tunnelingKeyThumbprint,
    git: opts.projectDirectory ? await detectGitMetadata(opts.projectDirectory) : undefined,
  }

  const newComposeModel = addComposeTunnelAgentService({
    tunnelOpts: opts.tunnelOpts,
    envId: opts.envId,
    debug: !!opts.debug,
    composeModelPath: './docker-compose.yml',
    envMetadata,
    knownServerPublicKeyPath: './tunnel_server_public_key',
    sshPrivateKeyPath: './tunneling_key',
    composeProject: opts.projectName,
    profileThumbprint: opts.tunnelingKeyThumbprint,
    privateMode,
    defaultAccess: privateMode ? 'private' : 'public',
  }, compose)

  if (opts.injectLivecycleScript) {
    set(newComposeModel, ['services', COMPOSE_TUNNEL_AGENT_SERVICE_NAME, 'environment', 'GLOBAL_INJECT_SCRIPTS'], JSON.stringify([{
      src: opts.injectLivecycleScript,
    }]))
  }

  return {
    data: newComposeModel,
    async write({ tunnelingKey, knownServerPublicKey } :
      {tunnelingKey: string | Buffer; knownServerPublicKey: string | Buffer}) {
      const composeTmpDir = await mkdtemp(path.join(tmpdir(), 'preevy-compose-tunnel-proxy-'))
      await Promise.all([
        writeFile(`${composeTmpDir}/tunnel_server_public_key`, knownServerPublicKey),
        writeFile(`${composeTmpDir}/tunneling_key`, tunnelingKey),
        writeFile(`${composeTmpDir}/docker-compose.yml`, JSON.stringify(newComposeModel)),
      ])
      return composeTmpDir
    },
  }
}
