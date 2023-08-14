import { TunnelNameResolver } from '@preevy/common'
import { generateSshKeyPair } from '../ssh/keypair'
import { ComposeModel, getExposedTcpServicePorts } from '../compose'

type port = string
type url = string
export type Tunnel = {
  project: string
  service: string
  ports: Record<port, url>
}

export type FlatTunnel = {
  project: string
  service: string
  port: number
  url: string
}

export const flattenTunnels = (
  tunnels: Tunnel[],
): FlatTunnel[] => tunnels
  .map(t => Object.entries(t.ports).map(([port, url]) => ({
    project: t.project,
    service: t.service,
    port: Number(port),
    url,
  })))
  .flat(2)

export const createTunnelingKey = async () => Buffer.from((await generateSshKeyPair('ed25519')).privateKey)

export const getTunnelNamesToServicePorts = (
  userModel: Pick<ComposeModel, 'services'>,
  tunnelNameForService: TunnelNameResolver,
) => Object.fromEntries(
  getExposedTcpServicePorts(userModel)
    .flatMap(servicePorts => tunnelNameForService(servicePorts).map(x => ({ name: servicePorts.name, ...x })))
    .map(({ tunnel, ...rest }) => [tunnel, rest])
)
