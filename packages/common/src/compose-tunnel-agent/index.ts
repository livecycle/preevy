export { COMPOSE_TUNNEL_AGENT_SERVICE_LABELS } from './labels.js'
export { ScriptInjection, parseScriptInjectionLabels, scriptInjectionsToLabels } from './script-injection.js'

export const COMPOSE_TUNNEL_AGENT_SERVICE_NAME = 'preevy_proxy'
export const COMPOSE_TUNNEL_AGENT_PORT = 3000

export type ComposeTunnelAgentState = {
  state: 'unknown'
  reason: string
} | {
  state: 'pending'
  pendingServices: string[]
} | {
  state: 'stable'
}
