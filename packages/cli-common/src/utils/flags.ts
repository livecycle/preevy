import { Flag } from '@oclif/core/lib/interfaces'

type FlagSpec<T> =Pick<Flag<T>, 'type' | 'default'>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function formatFlagsToArgs(flags: Record<string, unknown>, spec: Record<string, FlagSpec<any>> = {}) {
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
    return [`--${key}`, `${value}`]
  })
}
