import fastify from 'fastify'
import { Gauge, Counter, register } from 'prom-client'

export const sshConnectionsGauge = new Gauge({
  name: 'sshConnections',
  help: 'Current number of open SSH connections',
  labelNames: ['clientId'],
})

export const tunnelsGauge = new Gauge({
  name: 'tunnels',
  help: 'Current number of open tunnels',
  labelNames: ['clientId'],
})

export const requestsCounter = new Counter({
  name: 'requests',
  help: 'Counter of incoming requests',
  labelNames: ['clientId'],
})

register.setDefaultLabels({ serviceName: 'preevy-tunnel-server' })

export function runMetricsServer(port: number) {
  const app = fastify()

  app.get('/metrics', async (_request, reply) => {
    // TODO: changing the "void" below to await hangs, find out why and fix
    void reply.header('Content-Type', register.contentType)
    void reply.send(await register.metrics())
  })
  return app.listen({
    host: '0.0.0.0',
    port,
  })
}
