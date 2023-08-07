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
  serviceUrls,
}: {
  serviceAndPort?: { service: string; port?: number }
  tunnelingKey: string | Buffer
  includeAccessCredentials: boolean
  retryOpts: retry.Options
  showPreevyService: boolean
  serviceUrls: { name: string; port: number; url: string }[]
}) => {
  const credentials = await generateBasicAuthCredentials(jwtGenerator(tunnelingKey))

  const { tunnels } = await queryTunnels({
    serviceUrls,
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
