import retry from 'p-retry'
import { generateBasicAuthCredentials, jwtGenerator } from '../credentials'
import { queryTunnels } from '../compose-tunnel-agent-client'
import { flattenTunnels, tunnelUrlsForEnv } from '../tunneling'

export const urls = async ({
  envId,
  rootUrl,
  clientId,
  serviceAndPort,
  tunnelingKey,
  includeAccessCredentials,
  retryOpts,
  showPreevyService,
}: {
  envId: string
  rootUrl: string
  clientId: string
  serviceAndPort?: { service: string; port?: number }
  tunnelingKey: string | Buffer
  includeAccessCredentials: boolean
  retryOpts: retry.Options
  showPreevyService: boolean
}) => {
  const tunnelUrlsForService = tunnelUrlsForEnv({ envId, rootUrl: new URL(rootUrl), clientId })

  const credentials = await generateBasicAuthCredentials(jwtGenerator(tunnelingKey))

  const { tunnels } = await queryTunnels({
    tunnelUrlsForService,
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
