import { NotFoundError } from '../http-errors.js'

export class ContainerNotFoundError extends NotFoundError {
  constructor(containerId: string) {
    super(`Container "${containerId}" does not exist or is not managed by this agent`)
  }
}
