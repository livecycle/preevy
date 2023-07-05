import { queryTunnels } from '../compose-tunnel-agent-client'
import { flattenTunnels, tunnelUrlsForEnv } from '../tunneling'

export const urls = async ({ envId,
  rootUrl, clientId, projectName, serviceAndPort }: {
  envId: string
  projectName: string
  rootUrl: string
  clientId: string
  serviceAndPort?: { service: string; port?: number }
}) => {
  const tunnelUrlsForService = tunnelUrlsForEnv({ projectName, envId, rootUrl: new URL(rootUrl), clientId })

  const { tunnels } = await queryTunnels({ tunnelUrlsForService, retryOpts: { retries: 2 } })

  return flattenTunnels(tunnels)
    .filter(tunnel => !serviceAndPort || (
      tunnel.service === serviceAndPort.service && (!serviceAndPort.port || tunnel.port === serviceAndPort.port)
    ))
}
