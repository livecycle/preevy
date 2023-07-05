const concat = (...v: (string | number)[]) => v.join('-')
const tunnel = (port: number, v: (string | number)[]) => ({ port, tunnel: concat(...v).toLowerCase() })

export type TunnelNameResolver = (x: {
  name: string
  project: string
  ports: number[]
}) => {
  port: number
  tunnel: string
}[]

export const tunnelNameResolver = (
  { userDefinedSuffix }: { userDefinedSuffix?: string },
): TunnelNameResolver => ({ project, name, ports }) => {
  const suffix = userDefinedSuffix || project
  return ports.map(port => tunnel(port, ports.length > 1 ? [name, port, suffix] : [name, suffix]))
}
