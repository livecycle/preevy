import { RunningService } from './docker'

const concat = (...v: (string | number)[]) => v.join('-')
const tunnel = (port: number, v: (string | number)[]) => ({ port, tunnel: concat(...v) })

export type TunnelNameResolver = (x: Pick<RunningService, 'name' | 'project' | 'ports'>) => {
  port: number
  tunnel: string
}[]

export const tunnelNameResolver = (
  { userDefinedSuffix }: { userDefinedSuffix?: string },
): TunnelNameResolver => (
  { project, name, ports }: { project: string; name: string; ports: number[] }
) => (
  ports.length === 1
    ? [tunnel(ports[0], [name, userDefinedSuffix || project])]
    : ports.map(port => tunnel(port, [name, port, userDefinedSuffix || project]))
)
