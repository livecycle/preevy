import { Logger } from '@preevy/common'
import http from 'node:http'
import stream from 'node:stream'
import { inspect } from 'node:util'

export const respond = (res: http.ServerResponse, content: string, type = 'text/plain', status = 200) => {
  res.writeHead(status, { 'Content-Type': type })
  res.end(content)
}

export const respondJson = (
  res: http.ServerResponse,
  content: unknown,
  status = 200,
) => respond(res, JSON.stringify(content), 'application/json', status)

export const respondAccordingToAccept = (
  req: http.IncomingMessage,
  res: http.ServerResponse,
  message: string,
  status = 200,
) => (req.headers.accept?.toLowerCase().includes('json')
  ? respondJson(res, { message }, status)
  : respond(res, message, 'text/plain', status))

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly clientMessage: string,
    readonly cause?: unknown,
    readonly responseHeaders?: Record<string, string>
  ) {
    super(clientMessage)
  }
}

export class NotFoundError extends HttpError {
  static defaultMessage = 'Not found'
  constructor(clientMessage = NotFoundError.defaultMessage) {
    super(404, clientMessage)
  }
}

export class InternalError extends HttpError {
  static status = 500
  static defaultMessage = 'Internal error'
  constructor(err: unknown, clientMessage = InternalError.defaultMessage) {
    super(InternalError.status, clientMessage, err)
  }
}

export class BadGatewayError extends HttpError {
  static status = 502
  static defaultMessage = 'Bad gateway'
  constructor(clientMessage = InternalError.defaultMessage) {
    super(BadGatewayError.status, clientMessage)
  }
}

export class BadRequestError extends HttpError {
  static status = 400
  static defaultMessage = 'Bad request'
  constructor(reason?: string) {
    super(BadGatewayError.status, reason ? `${BadRequestError.defaultMessage}: ${reason}` : BadRequestError.defaultMessage)
  }
}

export const errorHandler = (
  log: Logger,
  err: unknown,
  req: http.IncomingMessage,
  res: http.ServerResponse,
) => {
  const [clientMessage, status, responseHeaders] = err instanceof HttpError
    ? [err.clientMessage, err.status, err.responseHeaders]
    : [InternalError.defaultMessage, InternalError.status, undefined]

  respondAccordingToAccept(req, res, clientMessage, status)
  Object.entries(responseHeaders || {}).forEach(([k, v]) => res.setHeader(k, v))
  log.warn('caught error: %j in %s %s', inspect(err), req.method || '', req.url || '')
}

export const tryHandler = (
  { log }: { log: Logger },
  f: (req: http.IncomingMessage, res: http.ServerResponse) => Promise<void>
) => async (req: http.IncomingMessage, res: http.ServerResponse) => {
  try {
    await f(req, res)
  } catch (err) {
    errorHandler(log, err, req, res)
  }
}

export const errorUpgradeHandler = (
  log: Logger,
  err: unknown,
  req: http.IncomingMessage,
  socket: stream.Duplex,
) => {
  const message: string = err instanceof HttpError
    ? err.clientMessage
    : InternalError.defaultMessage

  socket.end(message)
  log.warn('caught error: %j in upgrade %s %s', inspect(err), req.method || '', req.url || '')
}

export const tryUpgradeHandler = (
  { log }: { log: Logger },
  f: (req: http.IncomingMessage, socket: stream.Duplex, head: Buffer) => Promise<void>
) => async (req: http.IncomingMessage, socket: stream.Duplex, head: Buffer) => {
  try {
    await f(req, socket, head)
  } catch (err) {
    errorUpgradeHandler(log, err, req, socket)
  }
}
