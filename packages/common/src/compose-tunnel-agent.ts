import { extractSectionsFromLabels, parseBooleanLabelValue } from './compose-utils'

export const COMPOSE_TUNNEL_AGENT_SERVICE_LABELS = {
  PROFILE_THUMBPRINT: 'preevy.profile_thumbprint',
  PRIVATE_MODE: 'preevy.private_mode',
  ENV_ID: 'preevy.env_id',
  ACCESS: 'preevy.access',
  EXPOSE: 'preevy.expose',
  INJECT_SCRIPT_PREFIX: 'preevy.inject_script',
}

export const COMPOSE_TUNNEL_AGENT_SERVICE_NAME = 'preevy_proxy'
export const COMPOSE_TUNNEL_AGENT_PORT = 3000

export type ScriptInjection = {
  pathRegex?: RegExp
  src: string
  defer?: boolean
  async?: boolean
}

type Stringified<T> = {
  [k in keyof T]: string
}

const parseScriptInjection = ({ pathRegex, defer, async, src }: Stringified<ScriptInjection>):
 ScriptInjection | Error => {
  try {
    if (!src) {
      throw new Error('missing src')
    }
    return {
      ...pathRegex && { pathRegex: new RegExp(pathRegex) },
      ...defer && { defer: parseBooleanLabelValue(defer) },
      ...async && { async: parseBooleanLabelValue(async) },
      src,
    }
  } catch (e) {
    return e as Error
  }
}

export const scriptInjectionFromLabels = (labels : Record<string, string>): ScriptInjection[] => {
  const scripts = extractSectionsFromLabels<Stringified<ScriptInjection>>(
    COMPOSE_TUNNEL_AGENT_SERVICE_LABELS.INJECT_SCRIPT_PREFIX,
    labels
  )
  return Object.values(scripts)
    .map(parseScriptInjection)
    .filter((x): x is ScriptInjection => !(x instanceof Error))
}
