export type ErrorWithCode = Error & { statusCode: number }

export class BaseErrorWithCode extends Error implements ErrorWithCode {
  // noinspection JSUnusedGlobalSymbols
  constructor(clientMessage: string, readonly statusCode: number) {
    super(clientMessage)
  }
}

export class InternalServerError extends BaseErrorWithCode {
  constructor(clientMessage: string, statusCode: 500 | 501 | 502 | 503 = 500) {
    super(clientMessage, statusCode)
  }
}

export class NotFoundError extends BaseErrorWithCode {
  constructor(resource: string) {
    super(`${resource} not found`, 404)
  }
}

export class ForbiddenError extends BaseErrorWithCode {
  constructor(reason?: string) {
    super(['forbidden', reason].filter(Boolean).join(': '), 403)
  }
}

export class UnauthorizedError extends BaseErrorWithCode {
  constructor(reason: string) {
    super(`unauthorized: ${reason}`, 401)
  }
}
