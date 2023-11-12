import { groupBy, mapKeys, partition } from 'lodash'
import { inspect } from 'util'
import { COMPOSE_TUNNEL_AGENT_SERVICE_LABELS } from './labels'

export type ScriptInjection = {
  pathRegex?: RegExp
  src: string
  defer?: boolean
  async?: boolean
}

const parseBooleanLabelValue = (s:string) => s === 'true' || s === '1'

const parseScriptInjection = (o: Record<string, string>): ScriptInjection | Error => {
  // eslint-disable-next-line camelcase
  const { src, defer, async, path_regex } = o
  try {
    if (!src) {
      throw new Error('missing src')
    }
    return {
      // eslint-disable-next-line camelcase
      ...path_regex && { pathRegex: new RegExp(path_regex) },
      ...defer && { defer: parseBooleanLabelValue(defer) },
      ...async && { async: parseBooleanLabelValue(async) },
      src,
    }
  } catch (e) {
    return new Error(`error parsing script injection ${inspect(o)}: ${e}`, { cause: e })
  }
}

const scriptInjectionToLabels = (
  id: string,
  { src, async, defer, pathRegex }: ScriptInjection,
): Record<string, string> => mapKeys<Record<string, string>>({
  src,
  ...async && { async: 'true' },
  ...defer && { defer: 'true' },
  ...pathRegex && { path_regex: pathRegex.source },
}, (_value, key) => [COMPOSE_TUNNEL_AGENT_SERVICE_LABELS.INJECT_SCRIPT_PREFIX, id, key].join('.'))

export const scriptInjectionsToLabels = (
  injections: Record<string, ScriptInjection>
) => Object.fromEntries(
  Object.entries(injections).flatMap(([id, injection]) => Object.entries(scriptInjectionToLabels(id, injection)))
)

const groupedLabelsRe = /^(?<prefix>[^\s]+)\.(?<id>[^.\s]+)\.(?<key>[^.\s]+)$/
type ParsedGroupedLabelKey = { prefix: string; id: string; key: string }
const parseGroupedLabelKey = (key: string) => {
  const match = groupedLabelsRe.exec(key)
  return match && match.groups as ParsedGroupedLabelKey
}

const parseLabelsWithPrefixAndId = (
  labels: Record<string, string>,
  prefix: string,
): Record<string, string>[] => {
  const split: [ParsedGroupedLabelKey | null, string][] = Object.entries(labels)
    .map(([k, v]) => [parseGroupedLabelKey(k), v])
  const filteredForPrefix = split.filter(([k]) => k?.prefix === prefix) as [ParsedGroupedLabelKey, string][]
  const grouped = groupBy(filteredForPrefix, ([{ id }]) => id)
  return Object.values(grouped).map(group => Object.fromEntries(group.map(([{ key }, value]) => [key, value])))
}

export const parseScriptInjectionLabels = (
  labels: Record<string, string>,
): [ScriptInjection[], Error[]] => {
  const stringifiedInjections = parseLabelsWithPrefixAndId(
    labels,
    COMPOSE_TUNNEL_AGENT_SERVICE_LABELS.INJECT_SCRIPT_PREFIX,
  )
  const injectionOrErrors = stringifiedInjections.map(parseScriptInjection)
  return partition(injectionOrErrors, x => !(x instanceof Error)) as [ScriptInjection[], Error[]]
}
