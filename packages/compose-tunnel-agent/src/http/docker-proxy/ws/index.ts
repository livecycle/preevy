import { WsHandler } from './handler'
import exec from './handlers/exec'
import logs from './handlers/logs'

export const handlers: WsHandler[] = [
  exec,
  logs,
]

export { findHandler } from './handler'
