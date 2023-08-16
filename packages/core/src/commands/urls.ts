import retry from 'p-retry'
import { generateBasicAuthCredentials, jwtGenerator } from '../credentials'
import { queryTunnels } from '../compose-tunnel-agent-client'
import { flattenTunnels } from '../tunneling'

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
  includeAccessCredentials: boolean
  retryOpts: retry.Options
  showPreevyService: boolean
  composeTunnelServiceUrl: string
}) => {
  const credentials = await generateBasicAuthCredentials(jwtGenerator(tunnelingKey))

  const { tunnels } = await queryTunnels({
    composeTunnelServiceUrl,
    retryOpts,
    credentials,
    includeAccessCredentials,
    showPreevyService,
  })

  return flattenTunnels(tunnels)
    .filter(tunnel => !serviceAndPort || (
      tunnel.service === serviceAndPort.service && (!serviceAndPort.port || tunnel.port === serviceAndPort.port)
    ))
}
