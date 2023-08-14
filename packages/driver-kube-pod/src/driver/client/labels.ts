import { mapValues } from 'lodash'
import { truncateWithHash } from '@preevy/core'

const MAX_LABEL_LENGTH = 63

export const sanitizeLabel = (s: string) => truncateWithHash(
  s
    .replace(/[^a-zA-Z0-9_.-]/g, '-')
    .replace(/^[^a-zA-Z0-9]/, firstChar => `a${firstChar}`), // prepend alpha char if first char is not alpha
  MAX_LABEL_LENGTH,
)

export const sanitizeLabels = <T extends Record<string, string>>(labels: T) => mapValues(labels, sanitizeLabel) as T
