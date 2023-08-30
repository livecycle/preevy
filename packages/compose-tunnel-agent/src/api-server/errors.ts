import { BadRequestError, NotFoundError } from './http-server-helpers'

export class MissingContainerIdError extends BadRequestError {
  constructor() {
    super('Missing container id')
  }
}

export class ContainerNotFoundError extends NotFoundError {
  constructor(containerId: string) {
    super(`Container "${containerId}" does not exist or is not managed by this agent`)
  }
}
