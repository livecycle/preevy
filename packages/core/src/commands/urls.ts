import { queryTunnels } from '../compose-tunnel-agent-client'
import { flattenTunnels, tunnelUrlForEnv } from '../tunneling'

export const urls = async ({ envId, baseUrl, clientId, projectName, serviceAndPort }: {
  envId: string
  projectName: string
  baseUrl: string
  clientId: string
  serviceAndPort?: { service: string; port?: number }
}) => {
  const tunnelUrlForService = tunnelUrlForEnv({ projectName, envId, baseUrl: new URL(baseUrl), clientId })

  const { tunnels } = await queryTunnels({ tunnelUrlForService, retryOpts: { retries: 2 } })

  return flattenTunnels(tunnels)
    .filter(tunnel => !serviceAndPort || (
      tunnel.service === serviceAndPort.service && (!serviceAndPort.port || tunnel.port === serviceAndPort.port)
    ))
}
