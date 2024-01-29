import retry from 'p-retry'
import { COMPOSE_TUNNEL_AGENT_SERVICE_NAME } from '@preevy/common'
import { generateBasicAuthCredentials, jwtGenerator } from '../credentials/index.js'
import { queryTunnels } from '../compose-tunnel-agent-client.js'
import { FlatTunnel, flattenTunnels } from '../tunneling/index.js'

const tunnelFilter = ({ serviceAndPort, showPreevyService }: {
  serviceAndPort?: { service: string; port?: number }
  showPreevyService: boolean
}): ((tunnel: FlatTunnel) => boolean) => {
  if (serviceAndPort) {
    return ({ service, port }) => service === serviceAndPort.service
      && (!serviceAndPort.port || port === serviceAndPort.port)
  }
  if (!showPreevyService) {
    return ({ service }) => service !== COMPOSE_TUNNEL_AGENT_SERVICE_NAME
  }
  return () => true
}

export const urls = async ({
  serviceAndPort,
  tunnelingKey,
  includeAccessCredentials,
  retryOpts,
  showPreevyService,
  composeTunnelServiceUrl,
  fetchTimeout,
}: {
  serviceAndPort?: { service: string; port?: number }
  tunnelingKey: string | Buffer
  includeAccessCredentials: false | 'browser' | 'api'
  retryOpts: retry.Options
  showPreevyService: boolean
  composeTunnelServiceUrl: string
  fetchTimeout: number
}) => {
  const credentials = await generateBasicAuthCredentials(jwtGenerator(tunnelingKey))

  const tunnels = await queryTunnels({
    composeTunnelServiceUrl,
    retryOpts,
    credentials,
    includeAccessCredentials,
    fetchTimeout,
  })

  return flattenTunnels(tunnels).filter(tunnelFilter({ serviceAndPort, showPreevyService }))
}
