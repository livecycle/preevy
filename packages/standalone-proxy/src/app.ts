import Fastify from 'fastify'
import { fastifyRequestContext } from '@fastify/request-context'
import { appLoggerFromEnv } from './logging'
import http from 'http'
import internal from 'stream'

export const app = ({ sshPublicKey,isProxyRequest, proxyHandlers }: { 
  sshPublicKey: string
  isProxyRequest: (req: http.IncomingMessage) => boolean
  proxyHandlers: { wsHandler: (req: http.IncomingMessage, socket: internal.Duplex, head: Buffer) => void, handler: (req: http.IncomingMessage, res: http.ServerResponse) => void }
}) =>
  Fastify({
    serverFactory: (handler) => {
      const {wsHandler:proxyWsHandler, handler: proxyHandler } = proxyHandlers
      const server = http.createServer((req, res) => {
        if (isProxyRequest(req)){
          return proxyHandler(req, res)
        }
        return handler(req, res)
      })
      server.on('upgrade', (req, socket, head) => {
        if (isProxyRequest(req)){
          proxyWsHandler(req, socket, head)
        } else {
          socket.end()
        }
      })
      return server;
    },
    logger: appLoggerFromEnv(),
  })
    
    .register(fastifyRequestContext)
    .get('/healthz', { logLevel: 'warn' }, async () => 'OK')
    .get('/ssh-public-key', async () => sshPublicKey)

  
    
    
