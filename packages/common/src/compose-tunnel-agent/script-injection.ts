import z from 'zod'
import { camelCase, mapKeys, partition, snakeCase, map, groupBy } from 'lodash-es'
import { inspect } from 'util'
import { COMPOSE_TUNNEL_AGENT_SERVICE_LABELS } from './labels.js'

const strOrNumberBoolean = z.preprocess(s => s === true || s === 'true' || s === '1' || s === 1, z.boolean())
const strRegex = z.string().transform((s, ctx) => {
  try {
    return new RegExp(s)
  } catch (e) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `invalid regex: ${s}` })
    return z.NEVER
  }
})

export const scriptInjectionSchema = z.object({
  src: z.string(),
  pathRegex: strRegex.optional(),
  defer: strOrNumberBoolean.optional(),
  async: strOrNumberBoolean.optional(),
  port: z.preprocess(Number, z.number().min(1).max(65535)).optional(),
})

export type ScriptInjection = z.infer<typeof scriptInjectionSchema>

const zodCamelCasePreprocess = <T extends z.AnyZodObject>(
  zod: T,
) => z.preprocess<T>(v => mapKeys(v as T['shape'], (_, k) => camelCase(k)), zod)

export const parseScriptInjection = (o: Record<string, string>) => {
  const result = zodCamelCasePreprocess(scriptInjectionSchema).safeParse(o)
  if (!result.success) {
    return new Error(`error parsing script injection ${inspect(o)}: ${result.error.message}`)
  }
  return result.data
}

const stringifyScriptInjection = (
  { src, async, defer, pathRegex, port }: ScriptInjection,
): Record<string, string> => ({
  src,
  ...async && { async: 'true' },
  ...defer && { defer: 'true' },
  ...pathRegex && { pathRegex: pathRegex.source },
  ...port && { port: port.toString() },
})

const scriptInjectionToLabels = (
  id: string,
  val: ScriptInjection,
  transformKey: (k: string) => string = k => k,
): Record<string, string> => mapKeys(
  stringifyScriptInjection(val),
  (_value, key) => [COMPOSE_TUNNEL_AGENT_SERVICE_LABELS.INJECT_SCRIPT_PREFIX, id, transformKey(key)].join('.'),
)

export const scriptInjectionsToLabels = (
  injections: Record<string, ScriptInjection>
) => Object.fromEntries(
  Object.entries(injections)
    .flatMap(([id, injection]) => Object.entries(scriptInjectionToLabels(id, injection, snakeCase)))
)

const groupedLabelsRe = /^(?<prefix>[^\s]+)\.(?<id>[^.\s]+)\.(?<key>[^.\s]+)$/
type ParsedGroupedLabelKey = { prefix: string; id: string; key: string }
const parseGroupedLabelKey = (
  key: string
): ParsedGroupedLabelKey | undefined => groupedLabelsRe.exec(key)?.groups as ParsedGroupedLabelKey

const parseLabelsWithPrefixAndId = (
  labels: Record<string, string>,
  prefix: string,
): Record<string, string>[] => {
  const filtered = map(Object.entries(labels), ([k, v]) => [parseGroupedLabelKey(k), v])
    .filter(
      (kvp): kvp is [ParsedGroupedLabelKey, string] => (
        kvp[0] as ParsedGroupedLabelKey | undefined
      )?.prefix === prefix
    )
  const grouped = groupBy(
    filtered,
    ([{ id }]) => id,
  )
  return Object.values(grouped).map(group => Object.fromEntries(group.map(([{ key }, value]) => [key, value])))
}

const notAnError = <T>(val: T | Error): val is T => !(val instanceof Error)

export const parseScriptInjectionLabels = (
  labels: Record<string, string>,
): [ScriptInjection[], Error[]] => {
  const stringifiedInjections = parseLabelsWithPrefixAndId(
    labels,
    COMPOSE_TUNNEL_AGENT_SERVICE_LABELS.INJECT_SCRIPT_PREFIX,
  )
  const injectionOrErrors = stringifiedInjections.map(parseScriptInjection)
  return partition(injectionOrErrors, notAnError)
}
