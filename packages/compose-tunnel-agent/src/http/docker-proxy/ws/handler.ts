import http from 'node:http'
import { Logger } from 'pino'
import WebSocket from 'ws'
import Dockerode from 'dockerode'

type Context = { log: Logger; docker: Dockerode }
export type WsHandlerFunc = (
  ws: WebSocket,
  req: http.IncomingMessage,
  match: RegExpMatchArray,
  { log, docker }: Context,
) => Promise<void>

export type WsHandler = {
  matchRequest: RegExp
  handler: WsHandlerFunc
}

export const wsHandler = (
  matchRequest: RegExp,
  handler: WsHandlerFunc
) => ({ matchRequest, handler })

export const findHandler = (handlers: WsHandler[], req: http.IncomingMessage) => {
  for (const handler of handlers) {
    const match = handler.matchRequest.exec(req.url ?? '')
    if (match) {
      return { handler, match }
    }
  }
  return undefined
}
