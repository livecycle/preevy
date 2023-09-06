export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
    readonly cause?: unknown,
    readonly responseHeaders?: Record<string, string>
  ) {
    super(message)
  }
}

export class NotFoundError extends HttpError {
  static defaultMessage = 'Not found'
  constructor(message = NotFoundError.defaultMessage) {
    super(404, message)
  }
}

export class InternalError extends HttpError {
  static status = 500
  static defaultMessage = 'Internal error'
  constructor(err: unknown, message = InternalError.defaultMessage) {
    super(InternalError.status, message, err)
  }
}

export class BadGatewayError extends HttpError {
  static status = 502
  static defaultMessage = 'Bad gateway'
  constructor(message = InternalError.defaultMessage) {
    super(BadGatewayError.status, message)
  }
}

export class BadRequestError extends HttpError {
  static status = 400
  static message = 'Bad request'
  constructor(reason?: string) {
    super(BadGatewayError.status, reason ? `${BadRequestError.message}: ${reason}` : BadRequestError.message)
  }
}
