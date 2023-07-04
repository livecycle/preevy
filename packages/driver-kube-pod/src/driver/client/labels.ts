import { randomBytes } from 'crypto'

export const sanitizeLabel = (s: string) => s.replace(/[^a-zA-Z0-9-]/g, '')

const MAX_LABEL_LENGTH = 63

const truncatePrefixToMaxLength = (prefix: string, suffix: string, spareLength = 0) => {
  const maxPrefixLength = MAX_LABEL_LENGTH - suffix.length - 1 - spareLength
  return [prefix.substring(0, maxPrefixLength), suffix].join('-')
}

export const labelWithRandomSuffix = (s: string[], spareLength = 0) => {
  const prefix = s.map(sanitizeLabel).join('-')
  const suffix = sanitizeLabel(randomBytes(8).toString('base64url').toLowerCase())
  return truncatePrefixToMaxLength(prefix, suffix, spareLength)
}
