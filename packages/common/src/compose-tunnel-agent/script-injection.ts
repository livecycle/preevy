import z from 'zod'
import { groupBy, mapKeys, partition, snakeCase } from 'lodash-es'
import { inspect } from 'util'
import { COMPOSE_TUNNEL_AGENT_SERVICE_LABELS } from './labels.js'

export const scriptInjectionSchema = z.object({
  pathRegex: z.string().transform(s => new RegExp(s)).optional(),
  src: z.string(),
  defer: z.boolean().optional(),
  async: z.boolean().optional(),
})

export type ScriptInjection = z.infer<typeof scriptInjectionSchema>

export const containerScriptInjectionSchema = scriptInjectionSchema.extend({
  port: z.coerce.number().optional(),
})

export type ContainerScriptInjection = z.infer<typeof containerScriptInjectionSchema>

const parseBooleanLabelValue = (s: string) => s === 'true' || s === '1'

const parseNumber = (s: string): number => {
  const result = Number(s)
  if (Number.isNaN(result)) {
    throw new Error(`invalid number "${s}"`)
  }
  return result
}

export const parseScriptInjection = (
  o: Record<string, string>,
  transformKey: (k: string) => string = k => k,
): ContainerScriptInjection | Error => {
  const {
    [transformKey('src')]: src,
    [transformKey('defer')]: defer,
    [transformKey('async')]: async,
    [transformKey('pathRegex')]: pathRegex,
    [transformKey('port')]: port,
  } = o

  try {
    if (!src) {
      throw new Error('missing src')
    }
    return {
      // eslint-disable-next-line camelcase
      ...pathRegex && { pathRegex: new RegExp(pathRegex) },
      ...defer && { defer: parseBooleanLabelValue(defer) },
      ...async && { async: parseBooleanLabelValue(async) },
      ...port && { port: parseNumber(port) },
      src,
    }
  } catch (e) {
    return new Error(`error parsing script injection ${inspect(o)}: ${e}`, { cause: e })
  }
}

const scriptInjectionToRecord = (
  id: string,
  { src, async, defer, pathRegex, port }: ContainerScriptInjection,
  transformKey: (k: string) => string = k => k,
): Record<string, string> => mapKeys<Record<string, string>>({
  src,
  ...async && { async: 'true' },
  ...defer && { defer: 'true' },
  ...pathRegex && { pathRegex: pathRegex.source },
  ...port && { port: port.toString() },
}, (_value, key) => [COMPOSE_TUNNEL_AGENT_SERVICE_LABELS.INJECT_SCRIPT_PREFIX, id, transformKey(key)].join('.'))

export const scriptInjectionsToLabels = (
  injections: Record<string, ScriptInjection>
) => Object.fromEntries(
  Object.entries(injections)
    .flatMap(([id, injection]) => Object.entries(scriptInjectionToRecord(id, injection, snakeCase)))
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
): [ContainerScriptInjection[], Error[]] => {
  const stringifiedInjections = parseLabelsWithPrefixAndId(
    labels,
    COMPOSE_TUNNEL_AGENT_SERVICE_LABELS.INJECT_SCRIPT_PREFIX,
  )
  const injectionOrErrors = stringifiedInjections.map(x => parseScriptInjection(x, snakeCase))
  return partition(injectionOrErrors, x => !(x instanceof Error)) as [ContainerScriptInjection[], Error[]]
}
