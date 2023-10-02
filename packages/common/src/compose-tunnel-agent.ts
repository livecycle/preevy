import { camelCase, set, snakeCase } from 'lodash'

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
      ...defer && { defer: defer === 'true' },
      ...async && { async: async === 'true' },
      src,
    }
  } catch (e) {
    return e as Error
  }
}

export const extractSectionsFromLabels = <T>(prefix: string, labels: Record<string, string>) => {
  const re = new RegExp(`^${prefix.replace(/\./g, '\\.')}\\.(?<id>.+?)\\.(?<key>[^.]+)$`)
  const sections:{[id:string]: T } = {}
  for (const [label, value] of Object.entries(labels)) {
    const match = label.match(re)?.groups
    if (match) {
      set(sections, [match.id, camelCase(match.key)], value)
    }
  }
  return sections
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

const formatValueLabel = (x:unknown) => {
  if (x instanceof RegExp) {
    return x.source
  }
  return `${x}`
}

export const sectionToLabels = (prefix: string, section: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(section).map(([key, value]) => ([`${prefix}.${snakeCase(key)}`, formatValueLabel(value)])))
