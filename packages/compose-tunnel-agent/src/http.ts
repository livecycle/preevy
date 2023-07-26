import { Logger } from '@preevy/common'
import http from 'node:http'
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
  constructor(readonly status: number, readonly clientMessage: string, readonly cause?: unknown) {
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
    super(500, clientMessage, err)
  }
}

export const tryHandler = (
  { log }: { log: Logger },
  f: (req: http.IncomingMessage, res: http.ServerResponse) => Promise<void>
) => async (req: http.IncomingMessage, res: http.ServerResponse) => {
  try {
    await f(req, res)
  } catch (err) {
    const messageAndStatus: [string, number] = err instanceof HttpError
      ? [err.clientMessage, err.status]
      : [InternalError.defaultMessage, InternalError.status]

    respondAccordingToAccept(req, res, ...messageAndStatus)
    log.warn('caught error: %j in %s %s', inspect(err), req.method || '', req.url || '')
  }
}
