const tunnel = (port: number, v: (string | number)[]) => ({ port, tunnel: v.join('-').toLowerCase() })

export type TunnelNameResolver = (x: {
  name: string
  ports: number[]
}) => {
  port: number
  tunnel: string
}[]

export const tunnelNameResolver = (
  { envId }: { envId: string },
): TunnelNameResolver => ({ name, ports }) => ports.map(
  port => tunnel(port, ports.length > 1 ? [name, port, envId] : [name, envId]),
)
