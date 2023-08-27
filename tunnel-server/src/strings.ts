import { createHash } from 'crypto'

export const truncateWithHash = (s: string, sanitize: (s:string)=> string, maxLength: number, hashLength = 4, sep = '-') => {
  const sanitized = sanitize(s)
  if (s.length <= maxLength && sanitized === s) {
    return s
  }

  const suffix = createHash('md5').update(s).digest('base64url').replace(/[^a-zA-Z0-9]/g, '')
    .substring(0, hashLength)

  return [sanitized.substring(0, maxLength - suffix.length - sep.length), suffix].join(sep)
}
