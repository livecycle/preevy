import retry from 'p-retry'
import { generateBasicAuthCredentials, jwtGenerator } from '../credentials'
import { COMPOSE_TUNNEL_AGENT_SERVICE_NAME, queryTunnels } from '../compose-tunnel-agent-client'
import { FlatTunnel, flattenTunnels } from '../tunneling'

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
}: {
  serviceAndPort?: { service: string; port?: number }
  tunnelingKey: string | Buffer
  includeAccessCredentials: false | 'browser' | 'api'
  retryOpts: retry.Options
  showPreevyService: boolean
  composeTunnelServiceUrl: string
}) => {
  const credentials = await generateBasicAuthCredentials(jwtGenerator(tunnelingKey))

  const tunnels = await queryTunnels({
    composeTunnelServiceUrl,
    retryOpts,
    credentials,
    includeAccessCredentials,
  })

  return flattenTunnels(tunnels).filter(tunnelFilter({ serviceAndPort, showPreevyService }))
}
