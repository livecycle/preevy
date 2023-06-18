const concat = (...v: (string | number)[]) => v.join('-')
const tunnel = (port: number, v: (string | number)[]) => ({ port, tunnel: concat(...v).toLowerCase() })

export type TunnelNameResolver = (x: {
  name: string
  project: string
  port: number
}) => {
  port: number
  tunnel: string
}

export const tunnelNameResolver = (
  { userDefinedSuffix }: { userDefinedSuffix?: string },
): TunnelNameResolver => (
  { project, name, port }: { project: string; name: string; port: number }
) => tunnel(port, [name, userDefinedSuffix || project])
