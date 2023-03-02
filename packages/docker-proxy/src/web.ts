import http from 'node:http'
import { RunningService } from './docker.js'
import { TunnelNameResolver } from './tunnel-name.js'

type TunnelsResponse = {
  projects: Record<string, Record<string, Record<number, string[]>>>
  services: {
    project: string
    service: string
    ports: {
      name: string
      port: number
    }[]
  }[]
  tunnels: string[]
  clientId: string
}

const servicesResponse = (
  tunnelNameResolver: TunnelNameResolver, 
  clientId: string, 
  services: RunningService[],
) => ({
  projects: services.reduce((acc: TunnelsResponse['projects'], s) => ({
    ...acc,
    [s.project]: {
      ...acc[s.project],
      [s.name]: tunnelNameResolver(s).reduce((obj: Record<number, string[]>, { port, tunnel }) => { 
        (obj[port] ||= []).push(tunnel)
        return obj
      }, {}),
    },
  }), {}),
  services: services.map(s => ({
    project: s.project,
    service: s.name,
    ports: tunnelNameResolver(s).map(({ port, tunnel }) => ({ name: tunnel, port })),
  })),
  tunnels: services.flatMap(s => tunnelNameResolver(s).map(({ tunnel }) => tunnel)),
  clientId,
})

const createWebServer = ({ getTunnels, tunnelNameResolver }: { 
  getTunnels: () => Promise<{ services: RunningService[], clientId: string }>
  tunnelNameResolver: TunnelNameResolver
}) => {
  const server = http.createServer(async (req, res) => {
    if (req.url === '/tunnels') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      const { services, clientId } = await getTunnels()
      res.end(JSON.stringify(servicesResponse(tunnelNameResolver, clientId, services)))
      return
    }

    if (req.url === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'text/plain' })
      res.end('OK')
      return
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Not found')
  })

  return server
}

export default createWebServer