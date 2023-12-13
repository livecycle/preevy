import { mapValues } from 'lodash-es'
import { truncateWithHash } from '@preevy/core'

const MAX_LABEL_LENGTH = 63

// https://kubernetes.io/docs/concepts/overview/working-with-objects/labels/#syntax-and-character-set
export const sanitizeLabel = (s: string) => truncateWithHash(
  s
    .replace(/[^a-zA-Z0-9_.-]/g, '-')
    .replace(/^[^a-zA-Z0-9]/, firstChar => `a${firstChar}`) // prefix with alphanumeric if first char is not alphanumeric
    .replace(/[^a-zA-Z0-9]$/, lastChar => `${lastChar}z`), // suffix with alphanumeric if last char is not alphanumeric
  MAX_LABEL_LENGTH,
)

export const sanitizeLabels = <T extends Record<string, string>>(labels: T) => mapValues(labels, sanitizeLabel) as T
