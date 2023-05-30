import Fastify from 'fastify'
import { fastifyRequestContext } from '@fastify/request-context'
import http from 'http'
import internal from 'stream'
import {Logger} from 'pino'

export const app = ({ isProxyRequest, proxyHandlers, logger }: {
  isProxyRequest: (req: http.IncomingMessage) => boolean
  logger: Logger
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
          logger.warn('unexpected upgrade request %j', {url: req.url, host: req.headers['host']})
          socket.end()
        }
      })
      return server;
    },
    logger,
  })
    .register(fastifyRequestContext)
    .get('/healthz', { logLevel: 'warn' }, async () => 'OK')
