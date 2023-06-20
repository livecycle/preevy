import { randomBytes, createHash } from 'crypto'

export const sanitizeLabel = (s: string) => s.replace(/[^a-zA-Z0-9]/g, '')

const MAX_LABEL_LENGTH = 63

const truncatePrefixToMaxLength = (prefix: string, suffix: string, spareLength = 0) => {
  const maxPrefixLength = MAX_LABEL_LENGTH - suffix.length - 1 - spareLength
  return [prefix.substring(0, maxPrefixLength), suffix].join('-')
}

export const labelWithRandomSuffix = (s: string[], spareLength = 0) => {
  const prefix = s.map(sanitizeLabel).join('-')
  const suffix = sanitizeLabel(randomBytes(8).toString('base64url'))
  return truncatePrefixToMaxLength(prefix, suffix, spareLength)
}

export const uniqueStableLabelFrom = (s: string[], spareLength = 0) => {
  const prefix = s.map(sanitizeLabel).join('-')
  const hash = createHash('sha1').update(prefix).digest().toString('base64url')
  const suffix = sanitizeLabel(hash).substring(0, 10)
  return truncatePrefixToMaxLength(prefix, suffix, spareLength)
}
