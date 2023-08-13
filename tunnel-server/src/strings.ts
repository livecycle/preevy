import { createHash } from 'crypto'

export const truncateWithHash = (s: string, maxLength: number, hashLength = 4, sep = '-') => {
  if (s.length <= maxLength) {
    return s
  }

  const suffix = createHash('md5').update(s).digest('base64url').replace(/[^a-zA-Z0-9]/g, '')
    .substring(0, hashLength)

  return [s.substring(0, maxLength - suffix.length - sep.length), suffix].join(sep)
}
