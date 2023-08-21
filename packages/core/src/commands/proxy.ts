import { tunnelNameResolver } from '@preevy/common'
import { mkdtemp, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { tmpdir } from 'node:os'
import { Connection } from '../tunneling'
import { execPromiseStdout } from '../child-process'
import { COMPOSE_TUNNEL_AGENT_SERVICE_NAME, COMPOSE_TUNNEL_AGENT_PORT, addComposeTunnelAgentService } from '../compose-tunnel-agent-client'
import { ComposeModel } from '../compose'
import { TunnelOpts } from '../ssh'

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
  const getPreevyAgentContainer = async () => {
    const agentContainerId = await dockerCmd(`ps --filter ${projectFilter} --filter label=com.docker.compose.service=${agentServiceName} -q`)
    if (!agentContainerId) {
      return null
    }
    return agentContainerId
  }

  const getEnvId = async () => {
    const agentContainerId = await getPreevyAgentContainer()
    if (agentContainerId) {
      return await dockerCmd(`inspect ${agentContainerId}  --format '{{ index .Config.Labels "preevy.env_id"}}'`)
    }
    return null
  }
  return {
    getComposeNetworks,
    getPreevyAgentContainer,
    getEnvId,
  }
}

export function initProxyComposeModel(opts: {
  envId: string
  projectName: string
  tunnelOpts: TunnelOpts
  networks: ComposeModel['networks']
}) {
  const compose = {
    version: '3.8',
    name: opts.projectName,
    networks: opts.networks,
  }

  const newComposeModel = addComposeTunnelAgentService({
    tunnelOpts: opts.tunnelOpts,
    envId: opts.envId,
    debug: true,
    composeModelPath: './docker-compose.yml',
    envMetadata: {}, // can we get envMetadata from com.docker.compose.project.working_dir?
    knownServerPublicKeyPath: './tunnel_server_public_key',
    sshPrivateKeyPath: './tunneling_key',
  }, compose)

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
