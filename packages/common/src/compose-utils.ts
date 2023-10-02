import { set, camelCase, snakeCase } from 'lodash'

export const extractSectionsFromLabels = <T>(prefix: string, labels: Record<string, string>) => {
  const sections:{[id:string]: T } = {}
  const normalizedPrefix = prefix.endsWith('.') ? prefix : `${prefix}.`
  Object.entries(labels)
    .filter(([key]) => key.startsWith(normalizedPrefix))
    .map(([key, value]) => [...key.substring(normalizedPrefix.length).split('.'), value])
    .forEach(([id, prop, value]) => set(sections, [id, camelCase(prop)], value))
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
