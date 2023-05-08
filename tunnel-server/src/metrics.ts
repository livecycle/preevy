import fastify from 'fastify'
import { Gauge , Counter,register } from 'prom-client';

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

export function runMetricsServer(port: number){
  const app = fastify();

  app.get("/metrics", async (request, reply) => {
    reply.header('Content-Type', register.contentType);
		reply.send(await register.metrics())
  });
  return app.listen({
    host: "0.0.0.0",
    port,
  })
}
