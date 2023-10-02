import { set, camelCase, snakeCase } from 'lodash'

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

export const parseBooleanLabelValue = (s:string) => s === 'true' || s === '1'

const formatValueLabel = (x:unknown) => {
  if (x instanceof RegExp) {
    return x.source
  }
  return `${x}`
}

export const sectionToLabels = (prefix: string, section: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(section).map(([key, value]) => ([`${prefix}.${snakeCase(key)}`, formatValueLabel(value)])))
