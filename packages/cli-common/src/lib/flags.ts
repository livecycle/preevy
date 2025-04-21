import { Flag } from '@oclif/core/lib/interfaces/index.js'
import { Parser } from '@oclif/core/lib/parser/parse.js'

type FlagSpec<T> = Pick<Flag<T>, 'type' | 'default'>

export function formatFlagsToArgs(flags: Record<string, unknown>, spec: Record<string, FlagSpec<unknown>> = {}, prefix = '') {
  return Object.entries(flags).flatMap(function format(this: void, [key, value]):string[] {
    if (spec[key]?.default === value) {
      return []
    }
    if (Array.isArray(value)) {
      return value.flatMap(v => format([key, v]))
    }
    if (typeof value === 'boolean') {
      const defaultIsOn = spec[key]?.type === 'boolean' && spec[key].default === true
      if (!value && defaultIsOn) {
        return [`--no-${key}`]
      }
      return [`--${key}`]
    }
    if (typeof value === 'object') {
      return Object.entries(value ?? {}).flatMap(([k, v]) => format([`${key}-${k}`, v]))
    }
    return [`--${prefix}${key}`, `${value}`]
  })
}

export const parseFlags = async <T extends {}>(def: T, argv: string[]) => (await new Parser({
  flags: def,
  strict: false,
  args: {},
  context: undefined,
  argv,
}).parse()).flags

export type ParsedFlags<T extends {}> = Omit<Awaited<ReturnType<typeof parseFlags<T>>>, 'json'>
