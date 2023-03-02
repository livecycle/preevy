const concat = (...v: (string | number)[]) => v.join('-')
const tunnel = (port: number, v: (string | number)[]) => ({ port, tunnel: concat(...v) })

export const tunnelNameResolver = ({ project, name, ports } : {
  project: string, 
  name: string, 
  ports: number[]
}) => [
  ...ports.map(port => tunnel(port, [name, port, project])),
  ...ports.length === 1 ? [tunnel(ports[0], [name, project])] : []
]

export type TunnelNameResolver = typeof tunnelNameResolver
