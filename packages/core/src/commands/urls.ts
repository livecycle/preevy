import { queryTunnels } from '../compose-tunnel-agent-client'
import { flattenTunnels, tunnelUrlsForEnv } from '../tunneling'

export const urls = async ({ envId,
  rootUrl, clientId, serviceAndPort }: {
  envId: string
  rootUrl: string
  clientId: string
  serviceAndPort?: { service: string; port?: number }
}) => {
  const tunnelUrlsForService = tunnelUrlsForEnv({ envId, rootUrl: new URL(rootUrl), clientId })

  const { tunnels } = await queryTunnels({ tunnelUrlsForService, retryOpts: { retries: 2 } })

  return flattenTunnels(tunnels)
    .filter(tunnel => !serviceAndPort || (
      tunnel.service === serviceAndPort.service && (!serviceAndPort.port || tunnel.port === serviceAndPort.port)
    ))
}
